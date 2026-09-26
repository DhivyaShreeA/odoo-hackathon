import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import warehouseRoutes from "./routes/warehouses.js";
import categoryRoutes from "./routes/categories.js";
import receiptRoutes from "./routes/receipts.js";
import deliveryRoutes from "./routes/deliveries.js";
import transferRoutes from "./routes/transfers.js";
import adjustmentRoutes from "./routes/adjustments.js";
import dashboardRoutes from "./routes/dashboard.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

app.set("io", io);
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/receipts", receiptRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/adjustments", adjustmentRoutes);
app.use("/api/dashboard", dashboardRoutes);

// central error handler — so an unexpected error never crashes the server mid-demo
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`StockSense API running on http://localhost:${PORT}`));
