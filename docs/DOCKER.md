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

## Build or Pull?

Use `docker build` when you want to create an image from the local source code and `Dockerfile`:

```powershell
docker build -t shaderoute:v2 .
```

Use `docker pull` when you want to download an image that has already been published to Docker Hub:

```powershell
docker pull abhivk/shaderoute:v2
```

| Situation | Use |
| --- | --- |
| You changed `Dockerfile` or application source code | `docker build` |
| You want to test your local changes | `docker build`, then `docker run` |
| Someone else published a new Docker image | `docker pull` |
| You want to run the existing `v2` image | `docker pull`, then `docker run` |
| You want to publish your local image | `docker build`, `docker tag`, then `docker push` |

`docker build` reads the local `Dockerfile`; it does not use your published application image. It may download the base images in the Dockerfile. `docker pull` downloads the finished image from Docker Hub; it does not read your local files or Dockerfile.

If you change the Dockerfile or source code, rebuild before running:

```powershell
docker build -t shaderoute:v2 .
docker run --rm -p 5173:8080 shaderoute:v2
```

If you only want to run the published image:

```powershell
docker pull abhivk/shaderoute:v2
docker run --rm -p 5173:8080 abhivk/shaderoute:v2
```

The `v2` part is an image tag that identifies a version. Building with the same tag replaces the local tag; pushing with the same tag updates the Docker Hub tag.

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

The multi-stage Dockerfile first installs dependencies and creates the Vite `dist` output. Its final stage contains only the generated static files and an Nginx web server.

Check that the image was created:

```powershell
docker image ls shaderoute
```

### 4. Start the application

```powershell
docker run --rm --name shaderoute-app -p 5173:8080 shaderoute:v2
```

The `-p 5173:8080` option maps port `5173` on your computer to port `8080` inside the container. Nginx serves the production build on port `8080`.

The options mean:

- `--rm`: remove the stopped container automatically.
- `--name shaderoute-app`: give the container a predictable name.
- `-p 5173:8080`: map the host port to the container port.
- `shaderoute:v2`: run the `shaderoute` image with the `v2` tag.

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

Docker uploads only layers that are not already present in the repository. Unchanged layers may be reported as already existing.

## Option 2: Download and Run from Docker Hub

This is the workflow for another developer or user who wants to run the published application without cloning the source code or building an image.

### 1. Download the image

```powershell
docker pull abhivk/shaderoute:v2
```

Docker downloads the image layers from Docker Hub and stores them locally.

If the tag is already available locally, Docker may report that the image is up to date.

### 2. Start the application

```powershell
docker run --rm --name shaderoute-app -p 5173:8080 abhivk/shaderoute:v2
```

Open:

<http://localhost:5173>

Stop the application with `Ctrl+C`.

This workflow does not require the GitHub repository, Node.js, or a local build. It requires Docker and internet access for the image download and for the app's external map, search, and routing services.

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

### Inspect images and containers

List local images:

```powershell
docker image ls
```

List running containers:

```powershell
docker ps
```

Inspect image configuration:

```powershell
docker image inspect abhivk/shaderoute:v2
```

### Docker Hub or base-image network error

During `docker build`, Docker must reach Docker Hub to download `node:20-alpine` and `nginxinc/nginx-unprivileged:1.27-alpine`. During `docker pull`, it must reach Docker Hub to download `abhivk/shaderoute:v2`.

An error such as `lookup registry-1.docker.io: no such host` indicates a Docker Desktop DNS, proxy, VPN, firewall, or network problem. Restart Docker Desktop, check its proxy settings, temporarily disconnect a VPN, or try another network. Test the base images directly:

```powershell
docker pull node:20-alpine
docker pull nginxinc/nginx-unprivileged:1.27-alpine
```

### Use the published v2 image

Pull the latest version before running it:

```powershell
docker pull abhivk/shaderoute:v2
```

The application still needs internet access at runtime because location search, route calculation, map tiles, and sun-related data use external services.
