import React, { useEffect, useMemo, useState } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";

const LS_KEY = "app.theme.primary";

const COLORS = [
  { name: "Blue",   hex: "#0E4C92" },
  { name: "Indigo", hex: "#3949AB" },
  { name: "Teal",   hex: "#00796B" },
  { name: "Emerald",hex: "#1F8A70" },
  { name: "Purple", hex: "#7E57C2" },
  { name: "Rose",   hex: "#E11D48" },
  { name: "Orange", hex: "#FB8C00" },
];

export default function ThemeSwatchBar({ value, onChange }) {
  const [selected, setSelected] = useState(value || COLORS[0].hex);

  // load saved color on mount if parent didn't set one
  useEffect(() => {
    if (!value) {
      try {
        const saved = localStorage.getItem(LS_KEY);
        if (saved) {
          setSelected(saved);
          onChange?.(saved);
        }
      } catch {}
    }
  }, [value, onChange]);

  // keep in sync with parent value
  useEffect(() => {
    if (value && value !== selected) setSelected(value);
  }, [value]); // eslint-disable-line

  const handlePick = (hex) => {
    setSelected(hex);
    try { localStorage.setItem(LS_KEY, hex); } catch {}
    onChange?.(hex);
  };

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
      {COLORS.map((c) => {
        const active = selected === c.hex;
        return (
          <Tooltip key={c.hex} title={c.name}>
            <IconButton
              onClick={() => handlePick(c.hex)}
              size="small"
              sx={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                p: 0,
                bgcolor: c.hex,
                boxShadow: active ? 3 : 1,
                border: active ? "2px solid rgba(255,255,255,0.9)" : "2px solid rgba(0,0,0,0.1)",
              }}
            >
              {active ? <CheckIcon sx={{ color: "white", fontSize: 18 }} /> : null}
            </IconButton>
          </Tooltip>
        );
      })}
    </Box>
  );
}
