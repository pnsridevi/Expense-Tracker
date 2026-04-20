import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import "./config/db.js";
import authRoutes from "./routes/auth.js";
import paymentSourcesRouter from "./routes/PaymentSources.js";
import transactionsRouter from "./routes/transactions.js";
import emailRoutes from "./routes/emails.js";

dotenv.config();
const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/payment-sources", paymentSourcesRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/emails", emailRoutes);

app.listen(process.env.PORT || 5000, () =>
  console.log(`Server running on port ${process.env.PORT || 5000}`),
);
