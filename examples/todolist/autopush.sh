#! /bin/sh -e

inotifywait -m -r --exclude "\.swp$" -e modify . | xargs -n 1 -I {} echo "couchapp push" | bash