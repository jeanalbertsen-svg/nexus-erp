// client/src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Stack,
  TextField,
  Button,
  Typography,
  Checkbox,
  FormControlLabel,
  Alert,
} from "@mui/material";
import { loginUser } from "../api.js";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 👋 Smart time-of-day greeting
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good morning");
    else if (h < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await loginUser(email, password);
      onLogin({ ...user, remember });
    } catch (err) {
      setError(err.message || "Unable to sign in. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        minHeight: "100vh",
        width: "100vw",
        margin: 0,
        padding: 0,
        border: "none",
        outline: "none",
        overflow: "hidden",
        background:
          "radial-gradient(circle at top left, #1b3564 0%, #050814 55%, #020309 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper
        elevation={6}
        sx={{
          maxWidth: 420,
          width: "100%",
          p: 4,
          borderRadius: 3,
          background:
            "linear-gradient(145deg, #050b16 0%, #0c193f 40%, #102750 100%)",
          border: "none",
          color: "#f2f8faff",
        }}
      >
        <Stack spacing={3}>
          {/* --- Header: logo + greeting + title --- */}
          <Box sx={{ textAlign: "center" }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                mb: 1.5,
              }}
            >
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  bgcolor: "rgba(15,23,42,0.95)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 18px 35px rgba(15,23,42,0.7)",
                  bgcolor: "#020309",        // ✅ fallback so it can never be white
                }}   
              >
                <img
                  src="/ACTA_logo.png"
                  alt="Acta Logo"
                  style={{ height: 24 }}
                />
              </Box>
            </Box>

            <Typography
              variant="caption"
              sx={{
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "rgba(148,163,184,0.95)",
              }}
            >
              {greeting || "Welcome"}
            </Typography>

            <Typography
              variant="h6"
              fontWeight={600}
              sx={{ mt: 0.5, letterSpacing: 0.4 }}
            >
              Welcome to Acta ERP
            </Typography>

            <Typography
              variant="body2"
              sx={{ color: "rgba(226,232,240,0.85)", mt: 0.5 }}
            >
              Sign in with your Acta work account.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" variant="filled">
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2.5}>
              <TextField
                type="email"
                fullWidth
                variant="outlined"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Work email"
                autoComplete="email"
                required
                InputLabelProps={{
                  sx: { color: "rgba(255,255,255,0.75)" },
                }}
                InputProps={{
                  sx: {
                    bgcolor: "rgba(15,23,42,0.85)",
                    borderRadius: 2,
                    color: "#ffffff",
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(148,163,184,0.6)",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#3b82f6",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#3b82f6",
                    },
                  },
                }}
              />
              <TextField
                type="password"
                fullWidth
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                required
                InputLabelProps={{
                  sx: { color: "rgba(255,255,255,0.75)" },
                }}
                InputProps={{
                  sx: {
                    bgcolor: "rgba(15,23,42,0.85)",
                    borderRadius: 2,
                    color: "#ffffff",
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(148,163,184,0.6)",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#3b82f6",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#3b82f6",
                    },
                  },
                }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    size="small"
                    sx={{
                      color: "rgba(148,163,184,0.9)",
                      "&.Mui-checked": {
                        color: "#3b82f6",
                      },
                    }}
                  />
                }
                label={
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(226,232,240,0.9)" }}
                  >
                    Remember me on this device
                  </Typography>
                }
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={loading}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  py: 1.1,
                  bgcolor: "#0E4C92",
                  "&:hover": {
                    bgcolor: "#0b3a70",
                  },
                }}
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </Stack>
          </Box>

          <Typography
            variant="caption"
            sx={{ textAlign: "center", color: "rgba(148,163,184,0.9)" }}
          >
            Need access or forgot your password? Please contact your Acta system
            administrator.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
