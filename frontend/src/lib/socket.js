import { io } from "socket.io-client";

// Single shared connection. Any component can subscribe to "stock:changed"
// to refresh its data the moment someone (anywhere) validates a receipt,
// delivery, transfer, or adjustment. This is what makes the dashboard live.
export const socket = io("/", { autoConnect: true });
