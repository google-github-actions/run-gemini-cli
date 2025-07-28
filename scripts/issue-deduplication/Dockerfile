# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the shell to fail on pipe errors
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install GitHub CLI
RUN apt-get update && apt-get install -y --no-install-recommends curl gnupg && \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && \
    apt-get install -y --no-install-recommends gh=2.76.1 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the working directory
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the content of the local src directory to the working directory
COPY . .

# Make port 8080 available to the world outside this container
EXPOSE 8080

# Define environment variables.
ENV PORT=8080
ENV INSTANCE_PORT=5432
ENV DATABASE_NAME=postgres

# Required environment variables to be set at runtime:
# - GITHUB_TOKEN (gh will pick this up)
# - GEMINI_API_KEY
# - INSTANCE_HOST
# - DB_USER
# - DB_PASS

# Run mcp_server.py when the container launches
CMD ["python", "mcp_server.py"]
