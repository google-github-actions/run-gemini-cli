# Contributing to run-gemini-cli

First off, thank you for considering contributing to the run-gemini-cli!

## Contribution Workflow

Here is a summary of the contribution workflow.

1.  **Fork and Clone the Repository**
    - Fork the repository on GitHub by clicking the "Fork" button.
    - Clone your forked repository to your local machine:
      ```sh
      git clone https://github.com/YOUR_USERNAME/run-gemini-cli.git
      cd run-gemini-cli
      ```

2.  **Set Upstream Remote**
    - Add the original repository as the `upstream` remote. This will allow you to keep your fork in sync with the main project.
      ```sh
      git remote add upstream https://github.com/google-github-actions/run-gemini-cli.git
      ```

3.  **Create a Branch**
    - Create a new branch for your changes. A good branch name is descriptive of the changes you are making.
      ```sh
      git checkout -b your-descriptive-branch-name
      ```

4.  **Make Your Changes**
    - Now you can make your changes to the code.

5.  **Commit Your Changes**
    - Once you are happy with your changes, commit them with a descriptive commit message. We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.
      ```sh
      git add .
      git commit -m "feat: add new feature"
      ```

6.  **Keep Your Fork Synced**
    - Before you push your changes, you should sync your `main` branch with the `upstream` repository.
      ```sh
      git checkout main
      git pull upstream main
      ```

7.  **Rebase Your Branch**
    - Now, rebase your feature branch on top of the `main` branch. This will ensure that your changes are applied on top of the latest changes from the `upstream` repository.
      ```sh
      git checkout your-descriptive-branch-name
      git rebase main
      ```

8.  **Push Your Changes**
    - Push your changes to your forked repository.
      ```sh
      git push --force-with-lease origin your-descriptive-branch-name
      ```

9.  **Create a Pull Request**
    - Now you can go to your forked repository on GitHub and create a pull request.

## PR Review Process

Once you submit a pull request, a member of the team will review your changes. We may ask for changes or clarification on your implementation. Once your pull request is approved, it will be merged into the `main` branch.

## Community & Communication

If you have any questions or need help with your contribution, you can reach out to us on [GitHub Discussions](https://github.com/google-github-actions/run-gemini-cli/discussions).
