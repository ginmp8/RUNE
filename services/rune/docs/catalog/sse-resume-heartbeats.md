# Resumable Render Events

Render status streams emit Server-Sent Event identifiers, retry guidance, and heartbeat comments. Clients may reconnect with `Last-Event-ID` and avoid duplicate status delivery.
