#!/bin/bash

echo "Building TKO MCP Docker image..."
docker build -t tko-mcp:latest .

echo "Image built successfully!"
docker images | grep tko-mcp
