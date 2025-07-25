import os
import json
import logging
import subprocess
import time
from datetime import datetime, timezone
from typing import AsyncGenerator
import asyncio

import sqlalchemy
from google import genai
import numpy as np
from sqlalchemy.sql import text
from fastmcp import FastMCP

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

EMBEDDING_BATCH_SIZE = 100
GITHUB_API_BATCH_SIZE = 100
INITIAL_DELAY = 1.0
MAX_DELAY = 60.0
BACKOFF_FACTOR = 2.0

# --- Configuration ---
EMBEDDING_MODEL = 'models/gemini-embedding-001'
MAX_TOKEN_LIMIT = 2048
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set.")

# --- AlloyDB Configuration ---
INSTANCE_HOST = os.getenv("INSTANCE_HOST", "localhost")
INSTANCE_PORT = os.getenv("INSTANCE_PORT", "5432")
DATABASE_NAME = os.getenv("DATABASE_NAME", "postgres")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")

if not all([DB_USER, DB_PASS]):
    raise ValueError("DB_USER and DB_PASS environment variables must be set.")

# Initialize FastMCP server
mcp = FastMCP("MCP Server for gemini-cli triage", timeout=660.0)

def get_db_connection() -> sqlalchemy.engine.base.Engine:
    """Initializes a connection pool for AlloyDB."""
    db_url = sqlalchemy.engine.url.URL.create(
        drivername="postgresql+pg8000",
        username=DB_USER,
        password=DB_PASS,
        host=INSTANCE_HOST,
        port=int(INSTANCE_PORT),
        database=DATABASE_NAME,
    )
    # Add connection pool arguments for better performance
    engine = sqlalchemy.create_engine(
        db_url, pool_size=5, max_overflow=2, pool_timeout=30, pool_recycle=1800
    )
    return engine

engine = get_db_connection()

# --- Blocking I/O Functions ---

def init_database(engine):
    """
    Initializes the database table and vector extension if they don't exist.
    """
    print("Initializing database...")
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS issues (
                number INTEGER,
                repo_name TEXT,
                title TEXT,
                body TEXT,
                comments TEXT,
                github_updated_at TIMESTAMP,
                token_count INTEGER,
                truncated_text TEXT,
                embedding vector(768),
                embedding_last_refreshed_at TIMESTAMP,
                PRIMARY KEY (number, repo_name)
            );
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS issues_embedding_idx
            ON issues
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
        """))
        conn.commit()
    print("Database initialization complete.")


def get_issues_with_comments_sync(repo, issue_numbers=None):
    """
    Synchronous: Fetches issues and their comments from GitHub.
    If issue_numbers is None, fetches all open issues.
    """
    if issue_numbers is None:
        logger.info(f"Fetching all open issue numbers from GitHub for repo {repo}...")
        try:
            list_command = ["gh", "issue", "list", "--state", "open", "--json", "number,updatedAt", "--limit", "5000", "--repo", repo]
            result = subprocess.run(list_command, capture_output=True, text=True, check=True)
            metadata = json.loads(result.stdout)
            issue_numbers = [item['number'] for item in metadata]
            logger.info(f"Found {len(issue_numbers)} open issues.")
        except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
            logger.error(f"Error fetching issue numbers for repo {repo}: {e}")
            return []
    
    if not issue_numbers:
        return []

    logger.info(f"Fetching details for {len(issue_numbers)} issues with GraphQL...")
    owner, name = repo.split('/')
    all_issues = []

    for i in range(0, len(issue_numbers), GITHUB_API_BATCH_SIZE):
        batch_numbers = issue_numbers[i:i + GITHUB_API_BATCH_SIZE]
        logger.info(f"Fetching issue batch {i//GITHUB_API_BATCH_SIZE + 1}/{(len(issue_numbers) + GITHUB_API_BATCH_SIZE - 1)//GITHUB_API_BATCH_SIZE}")
        query_parts = [f"issue_{n}: issue(number: {n}) {{ title body updatedAt comments(first: 30) {{ nodes {{ body }} }} }}" for n in batch_numbers]
        full_query = f"query {{ repository(owner: \"{owner}\", name: \"{name}\") {{ {' '.join(query_parts)} }} }}"
        
        try:
            result = subprocess.run(["gh", "api", "graphql", "-f", f"query={full_query}"], capture_output=True, text=True, check=True)
            response_data = json.loads(result.stdout)
            
            if "errors" in response_data:
                logger.error(f"GraphQL API error: {response_data['errors']}")
                continue

            repo_data = response_data.get("data", {}).get("repository", {})
            for number in batch_numbers:
                issue_data = repo_data.get(f"issue_{number}")
                if issue_data:
                    issue_data["comments"] = issue_data.get("comments", {}).get("nodes", [])
                    issue_data["number"] = number
                    all_issues.append(issue_data)
        except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
            logger.error(f"Error during GraphQL request for batch starting with #{batch_numbers[0]}: {e}")

    logger.info("Finished fetching all issue details.")
    return all_issues


def save_issue_and_embedding_sync(issue, embedding, repo_name, token_count, truncated_text):
    """Synchronous: Saves an issue and its embedding to AlloyDB."""
    embedding_str = str(embedding.tolist()) if embedding is not None else None
    comments_json = json.dumps(issue.get('comments', []))

    stmt = text("""
        INSERT INTO issues (number, repo_name, title, body, comments, github_updated_at, token_count, truncated_text, embedding, embedding_last_refreshed_at)
        VALUES (:number, :repo_name, :title, :body, :comments, :github_updated_at, :token_count, :truncated_text, :embedding, :refreshed_at)
        ON CONFLICT (number, repo_name) DO UPDATE
        SET title = EXCLUDED.title,
            body = EXCLUDED.body,
            comments = EXCLUDED.comments,
            github_updated_at = EXCLUDED.github_updated_at,
            token_count = EXCLUDED.token_count,
            truncated_text = EXCLUDED.truncated_text,
            embedding = EXCLUDED.embedding,
            embedding_last_refreshed_at = EXCLUDED.embedding_last_refreshed_at;
    """)
    with engine.connect() as conn:
        conn.execute(stmt, {
            "number": issue['number'], "repo_name": repo_name, "title": issue['title'],
            "body": issue.get('body', ''), "comments": comments_json,
            "github_updated_at": issue.get('updatedAt'), "token_count": token_count,
            "truncated_text": truncated_text, "embedding": embedding_str,
            "refreshed_at": datetime.now(timezone.utc) if embedding is not None else None
        })
        conn.commit()

def generate_and_save_embedding_sync(issue, repo_name, embedding_dim=768):
    """Synchronous: Generates and saves a single embedding."""
    client = genai.Client(api_key=API_KEY)
    comments_text = " ".join([comment['body'] for comment in issue.get('comments', [])])
    full_text = f"Title: {issue['title']}\nBody: {issue['body']}\nComments: {comments_text}"

    if len(full_text) > MAX_TOKEN_LIMIT * 6:
        full_text = full_text[:MAX_TOKEN_LIMIT * 6]
    
    token_count = len(full_text.split())
    text_to_embed = full_text
    if token_count > MAX_TOKEN_LIMIT:
        text_to_embed = text_to_embed[:len(text_to_embed) // 2]

    try:
        result = client.models.embed_content(
            model=EMBEDDING_MODEL, contents=[text_to_embed],
            config={'task_type': 'SEMANTIC_SIMILARITY', 'output_dimensionality': embedding_dim}
        )
        embedding_np = np.array(result.embeddings[0].values)
        if embedding_dim != 3072:
            norm = np.linalg.norm(embedding_np)
            if norm > 0: embedding_np /= norm
        
        save_issue_and_embedding_sync(issue, embedding_np, repo_name, token_count, text_to_embed)
        return embedding_np
    except Exception as e:
        logger.error(f"Error generating embedding for issue #{issue['number']}: {e}", exc_info=True)
        return None

def generate_and_save_embeddings_sync(engine, issues, repo_name, embedding_dim=768, force=False):
    """
    Synchronous: Generates embeddings for new or updated issues and saves them to AlloyDB.
    """
    logger.info("Checking for new or updated issues to process...")
    client = genai.Client(api_key=API_KEY)
    
    if force:
        logger.info("Force option is True, processing all issues.")
        issues_to_process = issues
    else:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT number, github_updated_at, embedding_last_refreshed_at FROM issues WHERE repo_name = :repo"), {"repo": repo_name}).fetchall()
            db_issues = {row[0]: {"github_updated_at": row[1], "refreshed_at": row[2]} for row in result}

        issues_to_process = []
        for issue in issues:
            db_issue = db_issues.get(issue['number'])
            gh_updated_at = datetime.fromisoformat(issue['updatedAt'].replace('Z', '+00:00'))

            if not db_issue or not db_issue.get('refreshed_at') or not db_issue.get('github_updated_at'):
                issues_to_process.append(issue)
                continue

            db_updated_at = db_issue['github_updated_at'].replace(tzinfo=timezone.utc)

            if gh_updated_at > db_updated_at:
                issues_to_process.append(issue)
    
    if not issues_to_process:
        logger.info("All issue embeddings are up-to-date. Nothing to process.")
        return 0

    logger.info(f"Found {len(issues_to_process)} new or updated issues. Processing text and generating embeddings...")
    
    token_errors = []
    uncached_issues_for_embedding = []

    for issue in issues_to_process:
        comments_text = " ".join([comment['body'] for comment in issue.get('comments', [])])
        full_text = f"Title: {issue['title']}\nBody: {issue['body']}\nComments: {comments_text}"

        if len(full_text) > MAX_TOKEN_LIMIT * 6:
            full_text = full_text[:MAX_TOKEN_LIMIT * 6]
        
        try:
            token_result = client.models.count_tokens(model="gemini-1.5-flash-latest", contents=full_text)
            token_count = token_result.total_tokens
            
            text_to_embed = full_text
            if token_count > MAX_TOKEN_LIMIT:
                text_to_embed = text_to_embed[:len(text_to_embed) // 2]
            
            uncached_issues_for_embedding.append({
                "issue": issue, "text": text_to_embed,
                "token_count": token_count, "truncated_text": text_to_embed
            })
        except Exception as e:
            token_errors.append((issue['number'], str(e)))

    if token_errors:
        logger.warning(f"{len(token_errors)} issues had token counting errors and were skipped.")

    processed_count = 0
    for i in range(0, len(uncached_issues_for_embedding), EMBEDDING_BATCH_SIZE):
        batch = uncached_issues_for_embedding[i:i + EMBEDDING_BATCH_SIZE]
        texts_to_embed = [item['text'] for item in batch]
        
        retry_count = 0
        current_delay = INITIAL_DELAY
        while retry_count < 5:
            try:
                result = client.models.embed_content(
                    model=EMBEDDING_MODEL, contents=texts_to_embed,
                    config={'task_type': 'SEMANTIC_SIMILARITY', 'output_dimensionality': embedding_dim}
                )
                
                for j, item in enumerate(batch):
                    issue = item['issue']
                    token_count = item['token_count']
                    truncated_text = item['truncated_text']
                    
                    embedding_np = np.array(result.embeddings[j].values)
                    if embedding_dim != 3072:
                        norm = np.linalg.norm(embedding_np)
                        if norm > 0: embedding_np /= norm
                    
                    save_issue_and_embedding_sync(issue, embedding_np, repo_name, token_count, truncated_text)
                
                processed_count += len(batch)
                logger.info(f"Processed and saved batch of {len(batch)} embeddings.")
                break
            except Exception as e:
                if "429" in str(e):
                    retry_count += 1
                    logger.warning(f"Rate limit hit. Waiting {current_delay:.1f}s...")
                    time.sleep(current_delay)
                    current_delay *= BACKOFF_FACTOR
                else:
                    logger.error(f"Error generating embeddings for batch: {e}")
                    break
    
    logger.info(f"Successfully processed and saved {processed_count} embeddings to AlloyDB.")
    return processed_count

# --- MCP Tool Definition ---

@mcp.tool()
def refresh(repo_owner: str, repo_name: str, force: bool = False) -> str:
    """
    Updates the embeddings for all open issues in a repository.

    This involves fetching the latest state of all open issues from GitHub,
    generating new embeddings for issues that have been updated since the
    last refresh, and storing them in the database.

    Args:
        repo_owner: The owner of the repository, eg. `google-gemini`.
        repo_name: The name of the repository, eg. `gemini-cli`.
        force: If True, forces a refresh of all issues, ignoring the last refresh time.

    Returns:
        A JSON string indicating the number of issues processed.
    """
    repo = f"{repo_owner}/{repo_name}"
    logger.info(f"Starting embedding refresh for repository: {repo}")

    issues = get_issues_with_comments_sync(repo=repo)
    if not issues:
        message = f"No open issues found for repository '{repo}' or failed to fetch them."
        logger.warning(message)
        return json.dumps({"status": "completed", "message": message, "issues_processed": 0})
    
    # Initialize database if it doesn't exist
    init_database(engine)

    processed_count = generate_and_save_embeddings_sync(engine, issues, repo, force=force)
    
    message = f"Embedding refresh completed for repository '{repo}'. Processed {processed_count} issues."
    logger.info(message)
    return json.dumps({"status": "completed", "message": message, "issues_processed": processed_count})


@mcp.tool()
def duplicates(
    repo_owner: str, repo_name: str, issue_number: int, threshold: float = 0.9
) -> str:
    """
    Finds duplicate issues for a given issue.
    
    Args:
        repo_owner: The owner of the repository, eg. `google-gemini`.
        repo_name: The name of the repository, eg. `gemini-cli`.
        issue_number: The number of the issue to find duplicates for.
        threshold: The similarity threshold for finding duplicates. Do not specify threshold unless explicitly specified by the user.

    Returns:
        A JSON string with the original issue number, repository, and a list of duplicate issues.
        Each duplicate issue contains the issue number, title, and similarity score.
    
    """
    repo = f"{repo_owner}/{repo_name}"
    distance_threshold = 1 - threshold

    # Fetch issue data
    gh_issue_data = get_issues_with_comments_sync(repo, issue_numbers=[issue_number])
    if not gh_issue_data:
        return json.dumps({"error": f"Could not fetch issue #{issue_number} from GitHub repository '{repo}'."})
    gh_issue = gh_issue_data[0]

    gh_updated_at = datetime.fromisoformat(gh_issue['updatedAt'].replace('Z', '+00:00'))
    
    # Initialize database if it doesn't exist
    init_database(engine)

    # Check for cached embedding
    embedding_str = None
    with engine.connect() as conn:
        db_issue_result = conn.execute(text("SELECT github_updated_at, embedding FROM issues WHERE number = :num AND repo_name = :repo"), {"num": issue_number, "repo": repo}).fetchone()
        if db_issue_result and db_issue_result[1]:
            db_updated_at = db_issue_result[0].replace(tzinfo=timezone.utc) if db_issue_result[0] else None
            if db_updated_at and gh_updated_at <= db_updated_at:
                embedding_str = db_issue_result[1]

    # Generate new embedding if needed
    if embedding_str is None:
        embedding_np = generate_and_save_embedding_sync(gh_issue, repo)
        if embedding_np is None:
            return json.dumps({"error": f"Failed to generate embedding for issue #{issue_number}."})
        embedding_str = str(embedding_np.tolist())

    # Find similar issues
    with engine.connect() as conn:
        similar_issues_query = text("""
            SELECT number, title, (embedding <=> :embedding) as distance
            FROM issues WHERE repo_name = :repo AND number != :num AND (embedding <=> :embedding) < :distance
            ORDER BY distance ASC
        """)
        similar_issues_result = conn.execute(similar_issues_query, {
            "embedding": embedding_str, "repo": repo, "num": issue_number, "distance": distance_threshold
        }).fetchall()

    duplicates = [{"number": row[0], "title": row[1], "similarity": 1 - row[2]} for row in similar_issues_result]
    
    return json.dumps({
        "issue_number": issue_number,
        "repository": repo,
        "duplicates": duplicates
    })

if __name__ == "__main__":
    logger.info("MCP server started on stdio")
    # Could also use 'sse' transport, host="0.0.0.0" required for Cloud Run.
    asyncio.run(
        mcp.run_async(
            transport="stdio",
        )
    )
