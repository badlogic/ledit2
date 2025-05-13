# Get PID of existing proxy process and kill it if running
PID=$(ps aux | grep "node proxy.js" | grep -v grep | awk '{print $2}')
if [ ! -z "$PID" ]; then
    kill $PID
    echo "Stopped proxy server (PID: $PID)"
    # Wait a moment to ensure process is stopped
    sleep 1
fi

# Start the proxy server
nohup node proxy.js > output.log 2>&1 &
echo "Started new proxy server (PID: $!)"

