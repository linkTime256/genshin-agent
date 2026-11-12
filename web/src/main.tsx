import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("找不到 #root 挂载点");

// 不启用 StrictMode：它会重复触发 effect，导致 SSE 消息被发送两次。
createRoot(container).render(<App />);
