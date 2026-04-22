import { useEffect, useState } from "react";

function App() {
  const [message, setMessage] = useState("hi");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div>
      <h1>University Planner</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;