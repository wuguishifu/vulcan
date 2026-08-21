#!/bin/bash

set -e

if [ $# -lt 1 ]; then
    echo "Usage: $0 <app_name> [major|minor|patch]"
    echo "Example: $0 saturn patch"
    echo "Example: $0 vulcan minor"
    exit 1
fi

APP_NAME=$1
BUMP_TYPE=${2:-patch}

if [[ ! "$APP_NAME" =~ ^[a-z0-9-]+$ ]]; then
    echo "Invalid app name: $APP_NAME (use lowercase, hyphens, numbers only)"
    exit 1
fi

if [[ ! "$BUMP_TYPE" =~ ^(major|minor|patch)$ ]]; then
    echo "Invalid bump type: $BUMP_TYPE"
    echo "Usage: $0 <app_name> [major|minor|patch]"
    exit 1
fi

echo "Bumping version for $APP_NAME: $BUMP_TYPE"

LAST_TAG=$(git ls-remote --refs --tags origin "${APP_NAME}-v*" | cut -f2 | sed 's/refs\/tags\///' | sort -V -r | head -1)

if [ -z "$LAST_TAG" ]; then
    LAST_TAG="${APP_NAME}-v1.0.0"
fi

echo "Last tag: $LAST_TAG"

VERSION_ONLY=$(echo $LAST_TAG | sed "s/^${APP_NAME}-v//")
echo "Version only: $VERSION_ONLY"

IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION_ONLY"

echo "Parsed version components: MAJOR=$MAJOR, MINOR=$MINOR, PATCH=$PATCH"

if [[ -z "$MAJOR" || -z "$MINOR" || -z "$PATCH" ]]; then
    echo "Failed to parse version from tag: $LAST_TAG"
    echo "Version only: $VERSION_ONLY"
    exit 1
fi

echo "Current version for $APP_NAME: $MAJOR.$MINOR.$PATCH"

case $BUMP_TYPE in
    major)
        NEW_MAJOR=$((MAJOR + 1))
        NEW_MINOR=0
        NEW_PATCH=0
        ;;
    minor)
        NEW_MAJOR=$MAJOR
        NEW_MINOR=$((MINOR + 1))
        NEW_PATCH=0
        ;;
    patch)
        NEW_MAJOR=$MAJOR
        NEW_MINOR=$MINOR
        NEW_PATCH=$((PATCH + 1))
        ;;
esac

NEW_VERSION="$NEW_MAJOR.$NEW_MINOR.$NEW_PATCH"

echo "New version for $APP_NAME: $NEW_VERSION"

if [ -n "$GITHUB_OUTPUT" ]; then
    echo "version=$NEW_VERSION" >> $GITHUB_OUTPUT
fi
