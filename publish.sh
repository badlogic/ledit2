#!/bin/bash
set -e
npm run build
host=marioslab.io
host_dir=/home/badlogic/ledit.marioslab.io
current_date=$(date "+%Y-%m-%d %H:%M:%S")
commit_hash=$(git rev-parse HEAD)
echo "{\"date\": \"$current_date\", \"commit\": \"$commit_hash\"}" > html/version.json

rsync -avz --exclude node_modules --exclude .git --exclude data --exclude docker/data ./ $host:$host_dir

if [ "$1" == "server" ]; then
    echo "Publishing client & server"
    ssh -t $host "export LEDIT_DB_PASSWORD=$LEDIT_DB_PASSWORD && cd $host_dir && ./docker/control.sh stop && ./docker/control.sh start && ./docker/control.sh logs"
else
    echo "Publishing client only"
fi