import React, { useState, useEffect } from "react";
import "./App.css";
import {
  Button,
  TextField,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Snackbar,
  Paper,
  CircularProgress,
} from "@mui/material";

function App() {
  const [bases, setBases] = useState([]);
  const [selectedBase, setSelectedBase] = useState("");
  const [topN, setTopN] = useState(5);
  const [rows, setRows] = useState([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [graph, setGraph] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [notification, setNotification] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch("http://127.0.0.1:5000/list")
      .then((res) => res.json())
      .then((data) => {
        setBases(data);
        if (data.length) setSelectedBase(data[0]);
      })
      .catch(console.error);

  }, []);

  const handleBaseChange = (e) => {
    setSelectedBase(e.target.value);
    setRows([]);
    setAnswer("");
    setGraph(null);
  };

  const handleFetchRows = async () => {
    if (!selectedBase) {
      alert("Please select a dataset first.");
      return;
    }

    try {
      const res = await fetch(
        `http://127.0.0.1:5000/data?name=${selectedBase}&top=${topN}`
      );
      const data = await res.json();
      if (res.ok) setRows(data.rows);
      else alert(data.detail || "Error fetching data");
    } catch (error) {
      alert("Request failed");
    }
  };

  const handleQuery = async () => {
    if (!selectedBase || !question.trim()) {
      alert("Please select a dataset and enter a question.");
      return;
    }

    const url = new URL("http://127.0.0.1:5000/query");
    url.searchParams.append("name", selectedBase);
    url.searchParams.append("question", question);

    try {
      setLoading(true);
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setAnswer(data.answer);
        if (data.isGraph) {
          const base64Graph = `data:image/png;base64,${data.answer}`;
          setGraph(base64Graph);

          setHistory((prev) => {
            const newItem = {
              question,
              answer: null,
              isGraph: true,
              graph: base64Graph,
            };
            const newHistory = [...prev, newItem];

            return newHistory;
          });
        } else {
          setGraph(null);

          setHistory((prev) => {
            const newItem = {
              question,
              answer: data.answer,
              isGraph: false,
              graph: null,
            };
            const newHistory = [...prev, newItem];

            return newHistory;
          });
        }
      } else {
        alert(`Error: ${data.detail || data.error}`);
      }
    } catch (error) {
      console.error("Query failed:", error);
      alert("Query request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSelect = (e) => {
    if (e.target.files.length) setUploadFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!uploadFile) return alert("Please choose a file.");
    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const res = await fetch("http://127.0.0.1:5000/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setNotification(data.message);
        const listData = await fetch("http://127.0.0.1:5000/list").then((r) =>
          r.json()
        );
        setBases(listData);
      } else alert(data.detail || "Error uploading file");
    } catch (error) {
      alert("Upload failed");
    }
  };

  const handleRemoveDataset = async (base) => {
    if (!window.confirm(`Are you sure you want to remove '${base}'?`)) {
      return;
    }
    try {
      const url = new URL("http://127.0.0.1:5000/remove");
      url.searchParams.append("name", base);

      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        alert(data.message);
        const updated = await fetch("http://127.0.0.1:5000/list").then((r) => r.json());
        setBases(updated);

        if (selectedBase === base) {
          setSelectedBase(updated.length ? updated[0] : "");
          setRows([]);
          setAnswer("");
          setGraph(null);
        }
      } else {
        alert(`Error removing dataset: ${data.detail || data.error}`);
      }
    } catch (error) {
      alert("Remove request failed");
      console.error(error);
    }
  };

  return (
    <Paper className="app-container">
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <div className="section">
        <Typography variant="h6">Available Datasets</Typography>
        {bases.length === 0 ? (
          <Typography>No datasets found. Upload one!</Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Dataset Name</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bases.map((base) => (
                  <TableRow key={base}>
                    <TableCell>{base}</TableCell>
                    <TableCell align="right">
                      <Button
                        color="error"
                        onClick={() => handleRemoveDataset(base)}
                      > Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>

      <div className="section">
        <Typography variant="h6">Upload File</Typography>
        <div className="file-upload">
          <input
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={handleUploadSelect}
          />
          <Button variant="contained" onClick={handleUpload}>
            Upload
          </Button>
        </div>
      </div>

      <div className="section">
        <Typography variant="h6">Select Dataset</Typography>
        <Select
          value={selectedBase}
          onChange={handleBaseChange}
          style={{ width: 200 }}
        >
          {bases.map((base) => (
            <MenuItem key={base} value={base}>
              {base}
            </MenuItem>
          ))}
        </Select>
      </div>

      <div className="section">
        <Typography variant="h6">View Top Rows</Typography>
        <div className="top-rows-controls">
          <TextField
            type="number"
            value={topN}
            onChange={(e) => setTopN(parseInt(e.target.value))}
            label="Top N"
            style={{ width: 120 }}
          />
          <Button variant="contained" onClick={handleFetchRows}>
            Fetch Rows
          </Button>
        </div>

        {rows.length > 0 && (
          <TableContainer style={{ maxHeight: 400 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {Object.keys(rows[0]).map((key) => (
                    <TableCell key={key}>{key}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={idx}>
                    {Object.values(row).map((val, index) => (
                      <TableCell key={index}>{val}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>

      <div className="section">
        <Typography variant="h6">Ask a Question</Typography>
        <div className="ask-section">
          <TextField
            fullWidth
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            label="Question"
            variant="outlined"
          />
          <Button variant="contained" onClick={handleQuery}>
            Ask
          </Button>
        </div>

        {loading && <CircularProgress />}

        {!loading && !graph && answer && (
          <Typography variant="body1" gutterBottom>
            {answer}
          </Typography>
        )}

        {graph && (
          <div className="graph-box">
            <img src={graph} alt="Generated chart" style={{ width: "100%" }} />
          </div>
        )}
      </div>

      <div className="section">
        <Typography variant="h6">Prompt History</Typography>
        {history.length === 0 && (
          <Typography variant="body2">No prompts yet.</Typography>
        )}
        {history.map((item, idx) => (
          <div key={idx} style={{ marginBottom: "1rem" }}>
            <Typography variant="subtitle1">
              Q: {item.question}
            </Typography>
            {item.isGraph ? (
              <img
                src={item.graph}
                alt={`Graph result #${idx}`}
                style={{ width: "100%" }}
              />
            ) : (
              <Typography variant="body2">{item.answer}</Typography>
            )}
          </div>
        ))}

        {history.length > 0 && (
          <Button
            variant="outlined"
            onClick={() => {
              setHistory([]);
            }}
            style={{ marginTop: "1rem" }}
          >
            Clear History
          </Button>
        )}
      </div>

      <Snackbar
        open={!!notification}
        autoHideDuration={5000}
        onClose={() => setNotification("")}
        message={notification}
      />
    </Paper>
  );
}

export default App;
