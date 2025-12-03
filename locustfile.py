import os
import json
import time
from locust_plugins.users.ws import WebSocketUser, websocket_listener

# --- Configuration ---
# Set these variables to match your environment
# You can get the token from your .env file
PERSONAL_TOKEN = os.getenv("PERSONAL_TOKEN", "YOUR_SECRET_TOKEN_HERE")
CUSTOMER_ID = "test_customer"
DOC_ID = "test_bot"

# This is the JSON payload your server expects on connection.
# We are using data that will trigger the mock/testing path in your bot.py
# by setting "streamSid": "ws_mock_stream_sid".
MOCK_CALL_DATA = {
    "event": "start",
    "sequenceNumber": "1",
    "start": {
        "accountSid": "AC_mock_account_sid",
        "streamSid": "ws_mock_stream_sid",
        "callSid": "CA_mock_call_sid",
        "tracks": ["inbound", "outbound"],
        "customParameters": {
            "voice_bot_id": DOC_ID
        },
        "direction": "testing",
        "to": "9944421123",
        "from": "9944421124"
    }
}

class BotUser(WebSocketUser):
    # Time to wait between tasks (in this case, receiving messages)
    min_wait = 5000  # 5 seconds
    max_wait = 10000 # 10 seconds

    def on_start(self):
        """Called when a new user starts. Connects and sends initial data."""
        # The host is configured when you run locust (e.g., ws://localhost:8080)
        # Here we connect to the dynamic path.
        self.connect(f"/{PERSONAL_TOKEN}/{CUSTOMER_ID}/{DOC_ID}")

        print("User connected, sending initial messages...")

        # Your bot.py expects two messages upon connection.
        # 1. A temporary/ignored message
        self.send("temp_message_to_be_ignored")

        # 2. The main JSON payload with call data
        self.send(json.dumps(MOCK_CALL_DATA))
        print("Initial JSON payload sent.")

    def on_stop(self):
        """Called when a user is stopped."""
        print("User stopped, closing connection.")
        self.close()

    @task
    def receive_and_do_nothing(self):
        """
        The main task for the user is to just keep the connection alive
        and receive any messages the server might send.
        For an audio bot, the server will be streaming binary data,
        which we can just receive and ignore for this load test.
        """
        try:
            # We add a timeout so this task doesn't block forever
            message = self.ws.recv()
            # print(f"Received message: {message}")
        except Exception:
            # This is expected if the server doesn't send anything
            # or the connection is idle.
            pass