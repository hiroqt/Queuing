import { useEffect, useState } from "react";

function App() {
  const [values, setValues] = useState([]);

  useEffect(() => {
    // Replace with your actual ASP.NET Core port (e.g., https://localhost:5271/api/test)
    fetch('http://localhost:5271/api/test')
      .then(res => res.json())
      .then(data => setValues(data))
      .catch(err => console.error("Error connecting to API:", err));
  }, []);
  return (
    <div>
      <h1 class="text-3xl font-bold underline">Hello world!</h1>
      <ul>
        {values.map((val, index) => (
          <li key={index}>{val}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
