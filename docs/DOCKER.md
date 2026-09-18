# Docker Guide

This guide explains how to run ShadeRoute with Docker in two ways:

1. Build the image from the GitHub source code.
2. Download the published image from Docker Hub and run it.

## Prerequisites

Install and start Docker Desktop:

- [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
- [Docker Desktop for macOS](https://www.docker.com/products/docker-desktop/)
- [Docker Engine for Linux](https://docs.docker.com/engine/install/)

Verify that Docker is available:

```powershell
docker --version
docker run hello-world
```

## Option 1: Build from GitHub

This option downloads the source code and builds a local Docker image.

### 1. Clone the repository

```powershell
git clone https://github.com/abhi-vk/ShadeRoute.git
```

This creates a local `ShadeRoute` directory containing the project source code.

### 2. Enter the project directory

```powershell
cd ShadeRoute
```

### 3. Build the Docker image

```powershell
docker build -t shaderoute:v2 .
```

The `-t shaderoute:v2` option gives the image a name and version tag. The final `.` tells Docker to use the current directory as the build context and to read its `Dockerfile`.

Check that the image was created:

```powershell
docker image ls shaderoute
```

### 4. Start the application

```powershell
docker run --rm --name shaderoute-app -p 5173:8080 shaderoute:v2
```

The `-p 5173:8080` option maps port `5173` on your computer to port `8080` inside the container. Nginx serves the production build on port `8080`.

Open the application at:

<http://localhost:5173>

Keep the terminal open while using the application. Stop it with `Ctrl+C`.

### 5. Run in the background (optional)

```powershell
docker run -d --name shaderoute-app -p 5173:8080 shaderoute:v2
```

View the container:

```powershell
docker ps
```

Stop and remove it:

```powershell
docker stop shaderoute-app
docker rm shaderoute-app
```

## Publish an Image to Docker Hub

This section is for the project owner or anyone with permission to publish the image.

### 1. Create a Docker Hub repository

Create a public repository named `shaderoute` at <https://hub.docker.com/>.

The image name must use this format:

```text
DOCKERHUB_USERNAME/shaderoute:v2
```

For this project, the published image name is:

```text
abhivk/shaderoute:v2
```

### 2. Sign in to Docker Hub

```powershell
docker login
```

Use a Docker Hub access token instead of your account password when prompted. Never commit credentials or tokens to GitHub.

### 3. Tag the local image

```powershell
docker tag shaderoute:v2 abhivk/shaderoute:v2
```

Replace `abhivk` with your Docker Hub username when publishing from another account.

### 4. Push the image

```powershell
docker push abhivk/shaderoute:v2
```

After the push completes, the image is available at:

<https://hub.docker.com/r/abhivk/shaderoute>

## Option 2: Download and Run from Docker Hub

This is the workflow for another developer or user who wants to run the published application without cloning the source code or building an image.

### 1. Download the image

```powershell
docker pull abhivk/shaderoute:v2
```

Docker downloads the image layers from Docker Hub and stores them locally.

### 2. Start the application

```powershell
docker run --rm --name shaderoute-app -p 5173:8080 abhivk/shaderoute:v2
```

Open:

<http://localhost:5173>

Stop the application with `Ctrl+C`.

### 3. Run in the background (optional)

```powershell
docker run -d --name shaderoute-app -p 5173:8080 abhivk/shaderoute:v2
```

Stop it later with:

```powershell
docker stop shaderoute-app
```

## Command Summary

| Task | Command |
| --- | --- |
| Build locally | `docker build -t shaderoute:v2 .` |
| Run local image | `docker run --rm -p 5173:8080 shaderoute:v2` |
| Tag for Docker Hub | `docker tag shaderoute:v2 abhivk/shaderoute:v2` |
| Upload image | `docker push abhivk/shaderoute:v2` |
| Download image | `docker pull abhivk/shaderoute:v2` |
| Run Docker Hub image | `docker run --rm -p 5173:8080 abhivk/shaderoute:v2` |

## Troubleshooting

### Port 5173 is already in use

Use another host port, such as `8080`:

```powershell
docker run --rm -p 8080:8080 abhivk/shaderoute:v2
```

Then open <http://localhost:8080>.

### A container with this name already exists

Remove the old container:

```powershell
docker rm -f shaderoute-app
```

Then run the application again.

### Check container logs

For a background container:

```powershell
docker logs shaderoute-app
```

### Use the published v2 image

Pull the latest version before running it:

```powershell
docker pull abhivk/shaderoute:v2
```

The application still needs internet access at runtime because location search, route calculation, map tiles, and sun-related data use external services.
