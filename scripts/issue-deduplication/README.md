# MCP Server for GitHub Issue Deduplication

This server provides tools to find duplicate GitHub issues within a repository. It uses embeddings to represent the semantic meaning of an issue's title, body, and comments, and then compares these embeddings to find similarities.

The server is built using `FastMCP` and provides two main tools: `refresh` and `duplicates`.

## Setup

The setup process involves provisioning an AlloyDB database on Google Cloud and then configuring the server to connect to it.

### 1. Provision the AlloyDB Database

The `setup_alloydb.sh` script automates the creation of a new AlloyDB cluster and instance on Google Cloud.

**Usage:**

```bash
./setup_alloydb.sh --db-password YOUR_PASSWORD [OPTIONS]
```

**For Local Development:**

To run the server locally, you should configure the database to allow connections from your public IP address.

```bash
./setup_alloydb.sh \
  --db-password "YOUR_SUPER_SECRET_PASSWORD" \
  --ip-address "YOUR.IP.ADDRESS.0/32"
```

**For GitHub Actions**:

When running in a CI/CD environment like GitHub Actions, you should use a service account for authentication. The script will create the service account and grant it the necessary permissions. You can use the `principalSet` created when setting up [Workload Identify Federation](../setup_workload_identity.sh).


```bash
./setup_alloydb.sh \
  --project-id "YOUR_PROJECT_ID" \
  --region "YOUR_REGION" \
  --db-password "YOUR_SUPER_SECRET_PASSWORD" \
  --service-account "my-alloydb-sa" \
  --principal-set "//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/my-pool/subject/my-subject"
```

The script will output the necessary connection details upon completion.

You will also need to configure a step in your GitHub Actions workflow to run the AlloyDB Auth Proxy. This allows your action to securely connect to the database instance over localhost. The proxy will run as a background process.

```yaml
jobs:
    ...
    steps:
        ...
      # Download and install the AlloyDB Auth Proxy
      - name: 'Download AlloyDB Auth Proxy'
        run: |
          curl -o alloydb-auth-proxy https://storage.googleapis.com/alloydb-auth-proxy/v1.13.4/alloydb-auth-proxy.linux.amd64
          chmod +x alloydb-auth-proxy

      # 4. Start the Auth Proxy in the background
      # The proxy will listen on localhost (127.0.0.1) on port 5432.
      - name: 'Start AlloyDB Auth Proxy'
        run: ./alloydb-auth-proxy "YOUR_ALLOYDB_INSTANCE_CONNECTION_NAME" --public-ip -i --impersonate-service-account YOUR_SERVICE_ACCOUNT &

      # The `YOUR_ALLOYDB_INSTANCE_CONNECTION_NAME` is the full connection string for your AlloyDB instance, 
      # for example: projects/YOUR_PROJECT_ID/locations/YOUR_REGION/clusters/YOUR_CLUSTER_ID/instances/YOUR_INSTANCE_ID

```


### 2. Set Environment Variables

Before running the server, you need to set the following environment variables based on the output from the setup script and your Gemini API key.

- `GEMINI_API_KEY`: Your API key for the Gemini API, used for generating embeddings.
- `DB_USER`: The username for your AlloyDB database (e.g., `postgres`).
- `DB_PASS`: The password for your AlloyDB database.
- `INSTANCE_HOST`: The IP address or hostname of your AlloyDB instance (`localhost`, if running through the proxy).
- `INSTANCE_PORT`: The port number of your AlloyDB instance (default: 5432).
- `DATABASE_NAME`: The name of the database to use (default: postgres).
- `GITHUB_TOKEN`: Your Github Personal Access Token with repository read scope. 

## How to Run

The recommended way to run the server is by using the provided Dockerfile.

1.  **Build the Docker image:**

    ```bash
    docker build -t mcp-server .
    ```

2.  **Run the Docker container:**

    Pass the environment variables to the `docker run` command.

    ```bash
    docker run -i --rm \
      -e GITHUB_TOKEN="your-github-pat-token-with-repo-read-access"
      -e GEMINI_API_KEY="your-gemini-api-key" \
      -e DB_USER="postgres" \
      -e DB_PASS="your-password" \
      -e INSTANCE_HOST="your-instance-ip" \
      mcp-server
    ```

3.  **Configure `gemini-cli`:**

    To have `gemini-cli` use the running MCP server, you need to update your `settings.json` file. Add a new entry to the `mcpServers` object as shown below. This configuration allows `gemini-cli` to pass the required environment variables to the container securely.

    ```json
    {
      "mcpServers": {
        "issue_deduplication": {
          "command": "docker",
          "args": [
            "run",
            "-i",
            "--rm",
            "-e",
            "GITHUB_TOKEN",
            "-e",
            "GEMINI_API_KEY",
            "-e",
            "DB_USER",
            "-e",
            "DB_PASS",
            "-e",
            "INSTANCE_HOST",
            "mcp-server"
          ],
          "env": {
            "GITHUB_TOKEN": "${GITHUB_TOKEN}",
            "GEMINI_API_KEY": "${GEMINI_API_KEY}",
            "DB_USER": "${DB_USER}",
            "DB_PASS": "${DB_PASS}",
            "INSTANCE_HOST": "${INSTANCE_HOST}"
          },
          "enabled": true
        }
      }
    }
    ```

## Tools

### `refresh`

This tool updates the embeddings for all open issues in a repository. It fetches the latest state of all open issues from GitHub, generates new embeddings for issues that have been updated since the last refresh, and stores them in the database.

**Arguments:**

- `repo` (str): The repository in the format 'owner/name' (e.g., `google-gemini/gemini-cli`).
- `force` (bool, optional): If `True`, forces a refresh of all issues, ignoring the last refresh time. Defaults to `False`.

**Returns:**

A JSON string indicating the number of issues processed.

### `duplicates`

This tool finds duplicate issues for a given issue.

**Arguments:**

- `repo` (str): The repository in the format 'owner/name' (e.g., `google-gemini/gemini-cli`).
- `issue_number` (int): The number of the issue to find duplicates for.
- `threshold` (float, optional): The similarity threshold for finding duplicates. Defaults to `0.9`.

**Returns:**

A JSON string with the original issue number, repository, and a list of duplicate issues. Each duplicate issue contains the issue number, title, and similarity score.