// client/src/pages/Admin_ProjectManagement.jsx (Part 1/5)
import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Stack,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Chip,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  TablePagination,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Tooltip,
  LinearProgress,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import DashboardIcon from "@mui/icons-material/Dashboard";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import PeopleIcon from "@mui/icons-material/People";
import FlagIcon from "@mui/icons-material/Flag";
import EventIcon from "@mui/icons-material/Event";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import NotesIcon from "@mui/icons-material/Notes";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
} from "../api"; // adjust the path if your api file is elsewhere


// PDF export lib
import jsPDF from "jspdf";

// Simple helpers
const fmtDate = (d) => (d ? String(d).slice(0, 10) : "—");
const todayISO = () => new Date().toISOString().slice(0, 10);
const randomId = () => Math.random().toString(36).slice(2, 10);

// Generate next project ID/code in the form PRJ-001, PRJ-002, ...
const generateNextProjectId = (projects = []) => {
  const prefix = "PRJ-";
  const nums = projects
    .map((p) => {
      const m = String(p.id || "").match(/^PRJ-(\d+)$/);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter((n) => n != null);

  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
};

// Compute project progress from task list (average task.progress, fallback if no tasks)
const computeProjectProgressFromTasks = (tasks = [], fallback = 0) => {
  if (!tasks.length) return fallback ?? 0;
  const total = tasks.reduce((sum, t) => {
    if (typeof t.progress === "number") return sum + t.progress;
    return sum + (t.done ? 100 : 0);
  }, 0);
  return Math.round(total / tasks.length);
};

// Small util to extract content words from a title
const extractKeywords = (text = "") => {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w && w.length > 3);
};

const ACTION_STEPS = ["Analyse", "Explore", "Design", "Structure", "Plan", "Refine"];

const COLLAB_STEPS = [
  "Align with stakeholders",
  "Review together with the core team",
  "Validate with end users or representatives",
  "Check dependencies with other workstreams",
];

const DOC_STEPS = [
  "Document decisions and rationale",
  "Create a short briefing note",
  "Update the project backlog and workboard",
  "Summarise outcomes in the shared workspace",
];

const HANDOVER_STEPS = [
  "Hand over the results so the next task can start without blockers",
  "Publish a short recap to the team channel so everyone stays aligned",
  "Update the roadmap and confirm next milestones with the team",
  "Flag any open issues and agree who will follow up on them",
];

const DESCRIPTION_TEMPLATES = [
  (title, contextPhrase) =>
    `Deliver focused work on ${title.toLowerCase()} so that the team gets a clear and actionable outcome, ${contextPhrase}. Turn early ideas into a concrete plan with clear ownership.`,
  (title, contextPhrase) =>
    `Break down ${title.toLowerCase()} into a structured set of activities ${contextPhrase}. The output should be a simple overview that others can quickly understand and use in their daily work.`,
  (title, contextPhrase) =>
    `Coordinate ${title.toLowerCase()} across relevant stakeholders ${contextPhrase}. Capture key decisions and trade-offs so they are easy to revisit later in the project.`,
  (title, contextPhrase) =>
    `Experiment around ${title.toLowerCase()} and capture what works and what does not ${contextPhrase}. The result should be a short, practical recommendation that can guide the next phase.`,
];

/**
 * AI-like helper that generates a project summary based on basic fields.
 * Replace this with a backend AI call later if you want.
 */
const proposeProjectSummary = (project) => {
  const name = project.name || "this project";
  const client = project.client || "the client";
  const tags = (project.tags || []).slice(0, 3).join(", ");
  const scope = tags ? ` with a focus on ${tags}` : "";

  return `This project aims to design and deliver ${name} for ${client}${scope}. The scope covers planning, implementation and validation of key features, ensuring a stable rollout and clear value for stakeholders.`;
};

/**
 * AI-like helper that generates a task description and a set of sub tasks.
 * It tries to:
 * - Use the task name and project context
 * - Avoid just repeating the same wording for every task
 * - Keep sub tasks complementary to the main description
 */
const proposeTaskDetails = (task, project, index = 0) => {
  const rawTitle = (task.title || "Task").trim();
  const title = rawTitle || "Task";
  const keywords = extractKeywords(title);
  const mainKeyword = keywords[0] || "task";

  const projectContextRaw =
    project.summary || project.description || project.name || "";
  const projectContext = projectContextRaw.replace(/\s+/g, " ").slice(0, 140);

  const contextPhrase = projectContext
    ? `in line with the project goal: ${projectContext}`
    : "in line with the overall project objectives";

  const templateIndex = index % DESCRIPTION_TEMPLATES.length;
  const description = DESCRIPTION_TEMPLATES[templateIndex](
    title,
    contextPhrase,
    projectContext
  );

  const actionVerb = ACTION_STEPS[index % ACTION_STEPS.length];
  const collabStep = COLLAB_STEPS[index % COLLAB_STEPS.length];
  const docStep = DOC_STEPS[index % DOC_STEPS.length];
  const handoverStep = HANDOVER_STEPS[index % HANDOVER_STEPS.length];

  const areaPhrase = mainKeyword.length > 3 ? mainKeyword : "this area";

  const subTasks = [
    `${actionVerb} the current situation and clarify scope for ${areaPhrase}`,
    `${collabStep} and capture any risks, assumptions or constraints related to ${areaPhrase}`,
    `${docStep} for ${title.toLowerCase()} so everyone can see what was agreed`,
    handoverStep,
  ];

  return { description, subTasks };
};

/**
 * If user does not provide tasks (or leaves all titles empty),
 * auto-generate a first task that supports the project description.
 */
const ensureAutoTaskIfMissing = (project) => {
  const existingTasks = project.tasks || [];
  const hasNonEmptyTitle = existingTasks.some(
    (t) => (t.title || "").trim().length > 0
  );

  if (existingTasks.length && hasNonEmptyTitle) {
    return project;
  }

  const autoTitle = "Project initiation & scoping";
  const baseTask = {
    id: randomId(),
    title: autoTitle,
    owner: project.owner || "",
    startDate: project.startDate || todayISO(),
    endDate: project.dueDate || project.startDate || todayISO(),
    progress: 0,
    done: false,
  };

  const ai = proposeTaskDetails(baseTask, project, 0);
  const autoTask = {
    ...baseTask,
    description: ai.description,
    subTasks: ai.subTasks,
  };

  const tasks = [autoTask];
  const progress = computeProjectProgressFromTasks(tasks, project.progress);
  return { ...project, tasks, progress };
};

/**
 * Enrich tasks with AI descriptions and sub tasks before saving:
 * - If title is empty, generate a phase-like title
 * - If description or subTasks are missing, fill them with AI
 */
const enrichTasksWithAiOnSave = (project) => {
  const originalTasks = project.tasks || [];

  const tasks = originalTasks.map((t, idx) => {
    let title = (t.title || "").trim();
    if (!title) {
      if (idx === 0) title = "Project initiation & scoping";
      else if (idx === 1) title = "Requirements & solution outline";
      else title = `Work package ${idx + 1}`;
    }

    const baseTask = {
      id: t.id || randomId(),
      owner: t.owner || project.owner || "",
      startDate: t.startDate || project.startDate || todayISO(),
      endDate: t.endDate || project.dueDate || project.startDate || todayISO(),
      progress: typeof t.progress === "number" ? t.progress : 0,
      done: !!t.done,
      subTasks: Array.isArray(t.subTasks) ? t.subTasks : [],
      ...t,
      title,
    };

    const needsDescription =
      !baseTask.description || !baseTask.description.trim();
    const needsSubTasks =
      !Array.isArray(baseTask.subTasks) || baseTask.subTasks.length === 0;

    if (needsDescription || needsSubTasks) {
      const ai = proposeTaskDetails(baseTask, project, idx);
      if (needsDescription) baseTask.description = ai.description;
      if (needsSubTasks) baseTask.subTasks = ai.subTasks;
    }

    return baseTask;
  });

  const progress = computeProjectProgressFromTasks(tasks, project.progress);
  return { ...project, tasks, progress };
};

// In-memory sample data (replace with API later if you want)
const initialProjects = [
  {
    id: "PRJ-001",
    code: "ACTA-CRM",
    name: "Acta CRM Platform",
    owner: "Jean",
    client: "Acta Venture Partners",
    status: "active", // planned | active | on-hold | completed | cancelled
    priority: "high", // low | medium | high
    startDate: "2025-01-10",
    dueDate: "2025-04-30",
    progress: 62,
    budget: 120000,
    budgetUsed: 45000,
    tags: ["CRM", "Digital Transformation"],
    summary:
      "Delivery of a modern CRM platform for Acta to centralise client data, pipeline and reporting across the venture portfolio.",
    description:
      "Design and implementation of a unified CRM platform for Acta with inventory and back-office integrations.",
    tasks: [
      {
        id: "T-1",
        title: "Requirements workshop",
        description:
          "Facilitate workshops with key stakeholders to collect and prioritise CRM requirements.",
        subTasks: [
          "Prepare workshop agenda and materials",
          "Run workshop with investment and operations teams",
          "Consolidate requirements into a single backlog",
        ],
        done: true,
        owner: "Jean",
        startDate: "2025-01-10",
        endDate: "2025-01-12",
        progress: 100,
      },
      {
        id: "T-2",
        title: "Data model design",
        description:
          "Define CRM entities, relationships and data standards to support reporting and integrations.",
        subTasks: [
          "Identify core CRM entities and attributes",
          "Define relationships and constraints",
          "Review model with tech and business stakeholders",
        ],
        done: true,
        owner: "Jean",
        startDate: "2025-01-15",
        endDate: "2025-01-25",
        progress: 100,
      },
      {
        id: "T-3",
        title: "MVP UI prototype",
        description:
          "Create a first clickable UI prototype for the CRM main screens and validate with users.",
        subTasks: [
          "Design wireframes for core screens",
          "Build clickable prototype",
          "Run quick usability test with 3–5 users",
        ],
        done: false,
        owner: "Jean",
        startDate: "2025-02-01",
        endDate: "2025-02-20",
        progress: 40,
      },
      {
        id: "T-4",
        title: "Integration with stock moves",
        description:
          "Connect CRM entities with stock movements to enable portfolio monitoring and reporting.",
        subTasks: [
          "Identify integration points and data flows",
          "Implement integration endpoints",
          "Test data consistency and edge cases",
        ],
        done: false,
        owner: "Jean",
        startDate: "2025-02-21",
        endDate: "2025-03-10",
        progress: 20,
      },
    ],
    notes:
      "Focus on clean UX for admins + solid reporting. Align with existing inventory and back-office modules.",
  },
  {
    id: "PRJ-002",
    code: "CLEAN-PH",
    name: "CleanPH Booking Platform",
    owner: "Admin",
    client: "Clean PH",
    status: "planned",
    priority: "medium",
    startDate: "2025-03-01",
    dueDate: "2025-06-30",
    progress: 15,
    budget: 80000,
    budgetUsed: 10000,
    tags: ["Booking", "Operations"],
    summary:
      "Development of a booking and operations platform for CleanPH to manage cleaners, clients and schedules in one place.",
    description:
      "Multi-tenant booking and dashboard platform for cleaners and clients.",
    tasks: [
      {
        id: "T-5",
        title: "Define user journeys",
        description:
          "Map end-to-end journeys for clients and cleaners from registration to completed cleaning.",
        subTasks: [
          "Interview 3–5 existing customers",
          "Document main scenarios and pain points",
          "Create visual user journey maps",
        ],
        done: true,
        owner: "Admin",
        startDate: "2025-03-01",
        endDate: "2025-03-05",
        progress: 100,
      },
      {
        id: "T-6",
        title: "Design client profile view",
        description:
          "Design a clear client profile page that shows bookings, invoices and contact info.",
        subTasks: [
          "Draft layout for profile page",
          "Review design with stakeholders",
          "Prepare UI components for implementation",
        ],
        done: false,
        owner: "Admin",
        startDate: "2025-03-06",
        endDate: "2025-03-20",
        progress: 30,
      },
    ],
    notes: "",
  },
];

// Status / priority helpers
const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "on-hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const statusColor = (status) => {
  switch (status) {
    case "planned":
      return "info";
    case "active":
      return "primary";
    case "on-hold":
      return "warning";
    case "completed":
      return "success";
    case "cancelled":
      return "default";
    default:
      return "default";
  }
};

const priorityColor = (p) => {
  switch (p) {
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
      return "default";
    default:
      return "default";
  }
};

// Reusable dashboard view (used by View dialog)
function ProjectDashboard({ project }) {
  if (!project) return null;

  const tasks = project.tasks || [];

  return (
    <Stack spacing={2}>
      {/* Top KPIs */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 1.5, borderRadius: 2 }} variant="outlined">
            <Typography variant="caption" color="text.secondary">
              Status
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip
                size="small"
                label={project.status}
                color={statusColor(project.status)}
                variant="outlined"
              />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 1.5, borderRadius: 2 }} variant="outlined">
            <Typography variant="caption" color="text.secondary">
              Priority
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip
                size="small"
                label={project.priority}
                color={priorityColor(project.priority)}
                icon={<FlagIcon fontSize="small" />}
                variant={project.priority === "high" ? "filled" : "outlined"}
              />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 1.5, borderRadius: 2 }} variant="outlined">
            <Typography variant="caption" color="text.secondary">
              Timeline
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {fmtDate(project.startDate)} → {fmtDate(project.dueDate)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 1.5, borderRadius: 2 }} variant="outlined">
            <Typography variant="caption" color="text.secondary">
              Budget usage
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {project.budgetUsed
                ? `${project.budgetUsed.toLocaleString()} / ${
                    project.budget ? project.budget.toLocaleString() : "—"
                  } DKK`
                : "—"}
            </Typography>
            {project.budget > 0 && (
              <Box sx={{ mt: 0.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(
                    100,
                    (project.budgetUsed / project.budget) * 100
                  )}
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Summary, Description & Notes */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Typography variant="subtitle2">Project summary</Typography>
          <Paper sx={{ p: 1.2, borderRadius: 2, mb: 1 }} variant="outlined">
            <Typography variant="body2">
              {project.summary || "No summary added yet."}
            </Typography>
          </Paper>
          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            Detailed description
          </Typography>
          <Paper sx={{ p: 1.2, borderRadius: 2 }} variant="outlined">
            <Typography variant="body2">
              {project.description || "No description."}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Typography variant="subtitle2">Internal Notes</Typography>
          <Paper sx={{ p: 1.2, borderRadius: 2 }} variant="outlined">
            <Typography variant="body2">
              {project.notes || "No notes added yet."}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Progress & Tags */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2">Overall progress</Typography>
          <Paper sx={{ p: 1.2, borderRadius: 2 }} variant="outlined">
            <Stack spacing={1}>
              <Typography variant="body2">
                {project.progress || 0}% complete
              </Typography>
              <LinearProgress
                variant="determinate"
                value={project.progress || 0}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2">Tags</Typography>
          <Paper sx={{ p: 1.2, borderRadius: 2 }} variant="outlined">
            {(project.tags || []).length ? (
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ flexWrap: "wrap", mt: 0.5 }}
              >
                {project.tags.map((t) => (
                  <Chip key={t} size="small" label={t} />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No tags.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Tasks overview (read-only) */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Tasks overview
        </Typography>
        <Paper sx={{ borderRadius: 2 }} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Done</TableCell>
                <TableCell>Task</TableCell>
                <TableCell>Task description</TableCell>
                <TableCell>Sub tasks</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>End</TableCell>
                <TableCell align="right">Progress %</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell width={56}>
                    <Checkbox size="small" checked={!!t.done} disabled />
                  </TableCell>
                  <TableCell>{t.title}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: "pre-wrap" }}
                    >
                      {t.description || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {(t.subTasks || []).length
                        ? (t.subTasks || []).join(", ")
                        : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>{t.owner || "—"}</TableCell>
                  <TableCell>{fmtDate(t.startDate)}</TableCell>
                  <TableCell>{fmtDate(t.endDate)}</TableCell>
                  <TableCell align="right">
                    {typeof t.progress === "number"
                      ? t.progress
                      : t.done
                      ? 100
                      : 0}
                    %
                  </TableCell>
                </TableRow>
              ))}
              {tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Box sx={{ py: 1, color: "text.secondary" }}>
                      No tasks defined yet.
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </Stack>
  );
}
// client/src/pages/Admin_ProjectManagement.jsx (Part 2/5 - starts after ProjectDashboard)

export default function AdminProjectManagement() {
  const theme = useTheme();
  const fullScreenDashboard = useMediaQuery(theme.breakpoints.down("lg"));

// Project state (loaded from API)
const [projects, setProjects] = useState([]);

  // Filters & sorting
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [sort, setSort] = useState({ field: "dueDate", dir: "asc" });

  // Paging
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRpp] = useState(10);

  // Selection / details
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [editMode, setEditMode] = useState(false);

  // New/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogProject, setDialogProject] = useState(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);

  // View dashboard dialog
  const [viewOpen, setViewOpen] = useState(false);

  // New task draft (per selected project in details pane)
  const [taskDraft, setTaskDraft] = useState({
    title: "",
    owner: "",
    startDate: todayISO(),
    endDate: todayISO(),
    progress: 0,
  });

  // AI "loading" flags (UI only – replace with real async if you wire a backend)
  const [aiSummaryBusy, setAiSummaryBusy] = useState(false);
  const [aiTaskBusyIndex, setAiTaskBusyIndex] = useState(null);

const handleRefresh = async () => {
  try {
    const pager = await listProjects();
    setProjects(pager.items || []);
  } catch (err) {
    console.error("Failed to refresh projects:", err);
  }
};

  const owners = useMemo(() => {
    const set = new Set(projects.map((p) => p.owner).filter(Boolean));
    return Array.from(set).sort();
  }, [projects]);

  useEffect(() => {
  (async () => {
    try {
      const pager = await listProjects(); // { items, total, page, limit }
      setProjects(pager.items || []);
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  })();
}, []);


  // Derived: filtered + sorted projects
  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.code.toLowerCase().includes(term) ||
        (p.client || "").toLowerCase().includes(term);

      const matchesStatus = !statusFilter || p.status === statusFilter;
      const matchesPriority = !priorityFilter || p.priority === priorityFilter;
      const matchesOwner = !ownerFilter || p.owner === ownerFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesOwner;
    });
  }, [projects, search, statusFilter, priorityFilter, ownerFilter]);

  const sorted = useMemo(() => {
    const { field, dir } = sort;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      if (field === "progress" || field === "budget" || field === "budgetUsed") {
        const na = Number(av || 0);
        const nb = Number(bv || 0);
        return dir === "asc" ? na - nb : nb - na;
      }
      // default string/date comparison
      return dir === "asc"
        ? String(av || "").localeCompare(String(bv || ""))
        : String(bv || "").localeCompare(String(av || ""));
    });
    return arr;
  }, [filtered, sort]);

  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return sorted.slice(start, start + rowsPerPage);
  }, [sorted, page, rowsPerPage]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  // Reset task draft whenever selected project changes
  useEffect(() => {
    if (!selectedProject) {
      setTaskDraft({
        title: "",
        owner: "",
        startDate: todayISO(),
        endDate: todayISO(),
        progress: 0,
      });
      return;
    }
    setTaskDraft({
      title: "",
      owner: selectedProject.owner || "",
      startDate: selectedProject.startDate || todayISO(),
      endDate: selectedProject.dueDate || selectedProject.startDate || todayISO(),
      progress: 0,
    });
  }, [selectedProject]);

  // KPIs
  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === "active").length;
  const completedProjects = projects.filter((p) => p.status === "completed").length;
  const today = todayISO();
  const overdueProjects = projects.filter(
    (p) => p.status !== "completed" && p.dueDate && p.dueDate < today
  ).length;
// client/src/pages/Admin_ProjectManagement.jsx (Part 3/5)

/* ------------------------- CRUD helpers ------------------------- */

  const openNewDialog = () => {
    setEditMode(false);
    const newId = generateNextProjectId(projects);
    setDialogProject({
      id: newId,
      code: newId, // auto-generated project code, editable in the form
      name: "",
      owner: "",
      client: "",
      status: "planned",
      priority: "medium",
      startDate: todayISO(),
      dueDate: todayISO(),
      progress: 0,
      budget: 0,
      budgetUsed: 0,
      tags: [],
      summary: "",
      description: "",
      tasks: [],
      notes: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (project) => {
    setEditMode(true);
    // Ensure summary field exists when editing older data
    setDialogProject({
      summary: "",
      ...project,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setDialogProject(null);
    setAiSummaryBusy(false);
    setAiTaskBusyIndex(null);
  };

  const saveDialogProject = async () => {
    if (!dialogProject) return;

    // 1) Ensure there is at least one task
    let projectToSave = ensureAutoTaskIfMissing(dialogProject);
    // 2) Enrich all tasks with AI-generated descriptions + sub tasks if missing
    projectToSave = enrichTasksWithAiOnSave(projectToSave);

    try {
      if (editMode) {
        // Update existing project
        await updateProject(projectToSave.id, projectToSave);
      } else {
        // Create new project
        await createProject(projectToSave);
      }

      // Reload list from server so UI matches DB
      const pager = await listProjects();
      setProjects(pager.items || []);

      if (!selectedProjectId) setSelectedProjectId(projectToSave.id);
      closeDialog();
    } catch (err) {
      console.error("Failed to save project:", err);
    }
  };

  const openDeleteDialog = (project) => {
    setSelectedProjectId(project.id);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedProjectId) return;
    try {
      await deleteProject(selectedProjectId);
      const pager = await listProjects();
      setProjects(pager.items || []);
      setSelectedProjectId(null);
      setDeleteOpen(false);
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };


  const toggleTaskDone = (projectId, taskId) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const tasks = (p.tasks || []).map((t) => {
          if (t.id !== taskId) return t;
          const nextDone = !t.done;
          return {
            ...t,
            done: nextDone,
            progress: nextDone ? 100 : 0,
          };
        });
        const progress = computeProjectProgressFromTasks(tasks, p.progress);
        return { ...p, tasks, progress };
      })
    );
  };

  const updateTaskField = (projectId, taskId, field, value) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const tasks = (p.tasks || []).map((t) =>
          t.id === taskId ? { ...t, [field]: value } : t
        );
        const progress = computeProjectProgressFromTasks(tasks, p.progress);
        return { ...p, tasks, progress };
      })
    );
  };

  const addTaskToSelectedProject = () => {
    if (!selectedProject) return;
    if (!taskDraft.title.trim()) return;

    const rawProgress = Number(taskDraft.progress) || 0;
    const clampProgress = Math.max(0, Math.min(100, rawProgress));

    const baseTask = {
      id: randomId(),
      title: taskDraft.title.trim(),
      description: "",
      subTasks: [],
      owner: (taskDraft.owner || "").trim() || selectedProject.owner || "",
      startDate: taskDraft.startDate || todayISO(),
      endDate: taskDraft.endDate || taskDraft.startDate || todayISO(),
      progress: clampProgress,
      done: clampProgress >= 100,
    };

    // Auto-enrich with AI so that even ad-hoc tasks get smart descriptions
    const existingCount = (selectedProject.tasks || []).length;
    const ai = proposeTaskDetails(baseTask, selectedProject, existingCount);
    const newTask = {
      ...baseTask,
      description: ai.description,
      subTasks: ai.subTasks,
    };

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== selectedProject.id) return p;
        const tasks = [...(p.tasks || []), newTask];
        const progress = computeProjectProgressFromTasks(tasks, p.progress);
        return { ...p, tasks, progress };
      })
    );

    setTaskDraft((d) => ({
      ...d,
      title: "",
      progress: 0,
    }));
  };

  /* --------- Dialog-specific task handlers (New/Edit project) ----- */

  const handleDialogTaskFieldChange = (index, field, value) => {
    setDialogProject((prev) => {
      if (!prev) return prev;
      const tasks = [...(prev.tasks || [])];
      const existing =
        tasks[index] || {
          id: randomId(),
          title: "",
          description: "",
          subTasks: [],
          owner: prev.owner || "",
          startDate: prev.startDate || todayISO(),
          endDate: prev.dueDate || prev.startDate || todayISO(),
          progress: 0,
          done: false,
        };

      let updated = { ...existing };

      if (field === "progress") {
        const raw = Number(value) || 0;
        const val = Math.max(0, Math.min(100, raw));
        updated.progress = val;
        updated.done = val >= 100;
      } else if (field === "subTasks") {
        updated.subTasks = Array.isArray(value) ? value : [];
      } else {
        updated[field] = value;
      }

      tasks[index] = updated;
      const progress = computeProjectProgressFromTasks(tasks, prev.progress);
      return { ...prev, tasks, progress };
    });
  };

  const handleDialogTaskToggleDone = (index) => {
    setDialogProject((prev) => {
      if (!prev) return prev;
      const tasks = [...(prev.tasks || [])];
      const t = tasks[index];
      if (!t) return prev;
      const nextDone = !t.done;
      const nextProgress =
        nextDone ? 100 : t.progress && t.progress > 0 ? t.progress : 0;
      tasks[index] = { ...t, done: nextDone, progress: nextProgress };
      const progress = computeProjectProgressFromTasks(tasks, prev.progress);
      return { ...prev, tasks, progress };
    });
  };

  const handleDialogAddTask = () => {
    setDialogProject((prev) => {
      if (!prev) return prev;
      const tasks = [
        ...(prev.tasks || []),
        {
          id: randomId(),
          title: "",
          description: "",
          subTasks: [],
          owner: prev.owner || "",
          startDate: prev.startDate || todayISO(),
          endDate: prev.dueDate || prev.startDate || todayISO(),
          progress: 0,
          done: false,
        },
      ];
      const progress = computeProjectProgressFromTasks(tasks, prev.progress);
      return { ...prev, tasks, progress };
    });
  };

  const handleDialogRemoveTask = (index) => {
    setDialogProject((prev) => {
      if (!prev) return prev;
      const tasks = [...(prev.tasks || [])];
      tasks.splice(index, 1);
      const progress = computeProjectProgressFromTasks(tasks, prev.progress);
      return { ...prev, tasks, progress };
    });
  };

  /* --------------------------- UI handlers ------------------------ */

  const handleSortClick = (field) => {
    setSort((s) =>
      s.field === field
        ? { field, dir: s.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" }
    );
  };

  const sortLabel = (field, label) => {
    const isActive = sort.field === field;
    const arrow = isActive ? (sort.dir === "asc" ? "↑" : "↓") : "";
    return (
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
        {label}
        {arrow && (
          <Box component="span" sx={{ ml: 0.3, fontSize: "0.7em" }}>
            {arrow}
          </Box>
        )}
      </Box>
    );
  };

  const handleDialogFieldChange = (field, value) => {
    setDialogProject((p) => ({ ...p, [field]: value }));
  };

  /* ---------------------- AI handlers (UI only) ------------------- */

  const handleAiSuggestSummary = () => {
    if (!dialogProject) return;
    setAiSummaryBusy(true);
    const suggestion = proposeProjectSummary(dialogProject);
    setDialogProject((prev) => ({ ...prev, summary: suggestion }));
    setAiSummaryBusy(false);
  };

  const handleAiSuggestTaskDetails = (index) => {
    if (!dialogProject) return;
    setAiTaskBusyIndex(index);
    setDialogProject((prev) => {
      if (!prev) return prev;
      const tasks = [...(prev.tasks || [])];
      const t = tasks[index];
      if (!t) return prev;
      const ai = proposeTaskDetails(t, prev, index);
      tasks[index] = {
        ...t,
        description: ai.description,
        subTasks: ai.subTasks,
      };
      const progress = computeProjectProgressFromTasks(tasks, prev.progress);
      return { ...prev, tasks, progress };
    });
    setAiTaskBusyIndex(null);
  };
// client/src/pages/Admin_ProjectManagement.jsx (Part 4/5)

// Export a formal project status report as PDF (no screenshot)
  const handleExportProjectPdf = () => {
    if (!selectedProject) return;

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 15;
    const marginTop = 18;
    const marginBottom = 18;
    let y = marginTop;

    const addPageIfNeeded = (neededHeight = 6) => {
      if (y + neededHeight > pageHeight - marginBottom) {
        pdf.addPage();
        y = marginTop;
      }
    };

    const addSectionTitle = (title) => {
      addPageIfNeeded(10);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text(title, marginX, y);
      y += 6;
      pdf.setDrawColor(150);
      pdf.setLineWidth(0.3);
      pdf.line(marginX, y, pageWidth - marginX, y);
      y += 4;
    };

    const addLabelValueLine = (label, value) => {
      addPageIfNeeded(6);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(`${label}:`, marginX, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(String(value || "—"), marginX + 30, y);
      y += 5;
    };

    const addMultilineText = (text) => {
      const body = text && text.trim() ? text : "—";
      const maxWidth = pageWidth - marginX * 2;
      const lines = pdf.splitTextToSize(body, maxWidth);
      lines.forEach((line) => {
        addPageIfNeeded(5);
        pdf.text(line, marginX, y);
        y += 5;
      });
    };

    const project = selectedProject;
    const tasks = project.tasks || [];

    // ---------------- HEADER ----------------
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("Project Status Report", pageWidth / 2, y, { align: "center" });
    y += 8;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, marginX, y);
    y += 6;

    pdf.setDrawColor(25, 118, 210); // primary-like blue
    pdf.setLineWidth(0.5);
    pdf.line(marginX, y, pageWidth - marginX, y);
    y += 8;

    // ---------------- 1. OVERVIEW ----------------
    addSectionTitle("1. Project overview");

    addLabelValueLine("Project name", project.name);
    addLabelValueLine("Project code", project.code);
    addLabelValueLine("Client", project.client);
    addLabelValueLine("Owner", project.owner);
    addLabelValueLine("Status", project.status);
    addLabelValueLine("Priority", project.priority);
    addLabelValueLine(
      "Timeline",
      `${fmtDate(project.startDate)} -> ${fmtDate(project.dueDate)}`
    );

    // Summary
    y += 2;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("Project summary:", marginX, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    addMultilineText(project.summary);

    // Description
    y += 3;
    pdf.setFont("helvetica", "bold");
    pdf.text("Detailed description:", marginX, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    addMultilineText(project.description);

    // ---------------- 2. FINANCIAL OVERVIEW ----------------
    y += 4;
    addSectionTitle("2. Financial overview");

    const budget = project.budget || 0;
    const used = project.budgetUsed || 0;
    const utilization = budget ? Math.round((used / budget) * 100) : 0;

    addLabelValueLine("Budget (DKK)", budget ? budget.toLocaleString() : "—");
    addLabelValueLine("Used (DKK)", used ? used.toLocaleString() : "—");
    addLabelValueLine("Utilisation", budget ? `${utilization}%` : "—");

    // ---------------- 3. PROGRESS & TAGS ----------------
    y += 4;
    addSectionTitle("3. Progress & tags");

    addLabelValueLine("Overall progress", `${project.progress || 0}%`);

    pdf.setFont("helvetica", "bold");
    pdf.text("Tags:", marginX, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    const tags = project.tags || [];
    if (!tags.length) {
      addMultilineText("No tags defined.");
    } else {
      addMultilineText(tags.join(", "));
    }

    // ---------------- 4. TASKS ----------------
    y += 4;
    addSectionTitle("4. Tasks");

    if (!tasks.length) {
      addMultilineText("No tasks defined for this project.");
    } else {
      // Table layout
      const colDone = marginX;
      const colTask = marginX + 10;
      const colOwner = marginX + 80;
      const colStart = marginX + 120;
      const colEnd = marginX + 145;
      const colProg = marginX + 170;

      const addTaskHeader = () => {
        addPageIfNeeded(10);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text("Done", colDone, y);
        pdf.text("Task", colTask, y);
        pdf.text("Owner", colOwner, y);
        pdf.text("Start", colStart, y);
        pdf.text("End", colEnd, y);
        pdf.text("%", colProg, y);
        y += 4;
        pdf.setDrawColor(180);
        pdf.setLineWidth(0.3);
        pdf.line(marginX, y, pageWidth - marginX, y);
        y += 3;
      };

      addTaskHeader();
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);

      tasks.forEach((t) => {
        const lineHeight = 4;
        const rawTitle = t.title || "";
        const taskName =
          rawTitle.length > 40 ? rawTitle.slice(0, 37) + "..." : rawTitle || "—";

        addPageIfNeeded(lineHeight + 2);

        const doneText = t.done ? "✔" : "";
        pdf.text(doneText, colDone, y);
        pdf.text(taskName, colTask, y);
        pdf.text((t.owner || "—").toString(), colOwner, y);
        pdf.text(fmtDate(t.startDate), colStart, y);
        pdf.text(fmtDate(t.endDate), colEnd, y);

        const prog =
          typeof t.progress === "number" ? t.progress : t.done ? 100 : 0;
        pdf.text(String(prog), colProg, y);

        y += lineHeight;

        if (y > pageHeight - marginBottom) {
          pdf.addPage();
          y = marginTop;
          addTaskHeader();
        }
      });

      // Task descriptions & sub tasks block
      y += 5;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("Task descriptions and sub tasks:", marginX, y);
      y += 5;
      pdf.setFont("helvetica", "normal");

      tasks.forEach((t) => {
        addPageIfNeeded(8);
        const headerLine = `• ${t.title || "Task"}`;
        pdf.text(headerLine, marginX, y);
        y += 4;

        if (t.description) {
          addMultilineText(`Description: ${t.description}`);
        } else {
          addMultilineText("Description: —");
        }

        const st = t.subTasks || [];
        if (st.length) {
          addMultilineText(`Sub tasks: ${st.join("; ")}`);
        } else {
          addMultilineText("Sub tasks: —");
        }
        y += 2;
      });
    }

    // ---------------- 5. INTERNAL NOTES ----------------
    y += 4;
    addSectionTitle("5. Internal notes");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    addMultilineText(project.notes);

    // ---------------- FOOTER / SAVE ----------------
    const fileName = `${project.code || "project"}-report.pdf`;
    pdf.save(fileName);
  };

  /* ----------------------------- RENDER --------------------------- */
return (
  <Stack spacing={2} sx={{ maxWidth: 2500, mx: "auto", width: "100%" }}>
      {/* HEADER */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <DashboardIcon />
        <Typography variant="h5">Project Management (Admin)</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <TextField
          size="small"
          placeholder="Search project, code, client…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          InputProps={{
            startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5 }} />,
          }}
          sx={{ minWidth: 260 }}
        />
        <Tooltip title="Refresh (reload data)">
          <span>
            <IconButton color="primary" onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openNewDialog}
          sx={{ textTransform: "none" }}
        >
          New Project
        </Button>
      </Stack>

      {/* KPI STRIP */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
        <Paper sx={{ p: 1.5, borderRadius: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Total projects
          </Typography>
          <Typography variant="h6">{totalProjects}</Typography>
        </Paper>
        <Paper sx={{ p: 1.5, borderRadius: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Active
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6">{activeProjects}</Typography>
            <Chip label="Active" size="small" color="primary" />
          </Stack>
        </Paper>
        <Paper sx={{ p: 1.5, borderRadius: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Completed
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6">{completedProjects}</Typography>
            <Chip label="Done" size="small" color="success" />
          </Stack>
        </Paper>
        <Paper sx={{ p: 1.5, borderRadius: 2, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Overdue
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6">{overdueProjects}</Typography>
            <Chip
              label={overdueProjects ? "Attention" : "OK"}
              size="small"
              color={overdueProjects ? "error" : "default"}
            />
          </Stack>
        </Paper>
      </Stack>

      {/* FILTERS */}
      <Paper sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
            >
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              label="Priority"
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(0);
              }}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Owner</InputLabel>
            <Select
              label="Owner"
              value={ownerFilter}
              onChange={(e) => {
                setOwnerFilter(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="">
                <em>All</em>
              </MenuItem>
              {owners.map((o) => (
                <MenuItem key={o} value={o}>
                  {o}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="caption" color="text.secondary">
            Showing {sorted.length} project(s)
          </Typography>
        </Stack>
      </Paper>

      {/* TABLE + DETAILS LAYOUT */}
      <Stack direction={{ xs: "column", xl: "row" }} spacing={2}>
        {/* TABLE */}
        <Paper sx={{ p: 0, borderRadius: 3, flex: 1.2, minWidth: 420 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{ cursor: "pointer" }}
                  onClick={() => handleSortClick("code")}
                >
                  {sortLabel("code", "Code")}
                </TableCell>
                <TableCell
                  sx={{ cursor: "pointer" }}
                  onClick={() => handleSortClick("name")}
                >
                  {sortLabel("name", "Project")}
                </TableCell>
                <TableCell
                  sx={{ cursor: "pointer" }}
                  onClick={() => handleSortClick("owner")}
                >
                  {sortLabel("owner", "Owner")}
                </TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell
                  sx={{ cursor: "pointer" }}
                  onClick={() => handleSortClick("dueDate")}
                >
                  {sortLabel("dueDate", "Due")}
                </TableCell>
                <TableCell
                  sx={{ cursor: "pointer" }}
                  onClick={() => handleSortClick("progress")}
                  align="right"
                >
                  {sortLabel("progress", "%")}
                </TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((p) => {
                const isSelected = selectedProjectId === p.id;
                return (
                  <TableRow
                    key={p.id}
                    hover
                    selected={isSelected}
                    sx={{ cursor: "pointer" }}
                    onClick={() => setSelectedProjectId(p.id)}
                  >
                    <TableCell sx={{ fontFamily: "monospace" }}>
                      {p.code}
                    </TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.owner || "—"}</TableCell>
                    <TableCell>{p.client || "—"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={p.status || "—"}
                        color={statusColor(p.status)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={p.priority || "—"}
                        color={priorityColor(p.priority)}
                        variant={p.priority === "high" ? "filled" : "outlined"}
                        icon={<FlagIcon fontSize="small" />}
                      />
                    </TableCell>
                    <TableCell>{fmtDate(p.dueDate)}</TableCell>
                    <TableCell align="right" sx={{ minWidth: 100 }}>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography
                          variant="caption"
                          sx={{ minWidth: 28 }}
                          align="right"
                        >
                          {p.progress || 0}%
                        </Typography>
                        <Box sx={{ flex: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={p.progress || 0}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={0.5}
                        justifyContent="flex-end"
                      >
                        <Tooltip title="Edit project">
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(p);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Delete project">
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteDialog(p);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Box sx={{ py: 2, color: "text.secondary" }}>
                      No projects match the current filters.
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={sorted.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRpp(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Paper>
        <Paper
          sx={{
            p: 2,
            borderRadius: 3,
            flex: 1.8,
            minWidth: 480,
            maxHeight: "80vh",
            overflow: "auto",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="subtitle1">Project Details</Typography>
            <Box sx={{ flexGrow: 1 }} />
            {selectedProject && (
              <>
                <Tooltip title="View full project dashboard">
                  <span>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={() => setViewOpen(true)}
                      sx={{ textTransform: "none", mr: 1 }}
                    >
                      View
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Export formal project report (PDF)">
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleExportProjectPdf}
                      sx={{ textTransform: "none", mr: 1 }}
                    >
                      Export report (PDF)
                    </Button>
                  </span>
                </Tooltip>
                <IconButton
                  size="small"
                  onClick={() => setSelectedProjectId(null)}
                  title="Clear selection"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Stack>
          <Divider sx={{ mb: 1 }} />

          {!selectedProject ? (
            <Box sx={{ py: 3, color: "text.secondary" }}>
              Select a project from the table to see details.
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {/* Header */}
              <Paper
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: (t) =>
                    `linear-gradient(90deg, ${t.palette.primary.main} 0%, ${t.palette.primary.dark} 100%)`,
                  color: "primary.contrastText",
                }}
              >
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  {selectedProject.code}
                </Typography>
                <Typography variant="h6" sx={{ mb: 0.5 }}>
                  {selectedProject.name}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                  <Chip
                    size="small"
                    icon={<PeopleIcon fontSize="small" />}
                    label={selectedProject.owner || "No owner"}
                    sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "inherit" }}
                  />
                  <Chip
                    size="small"
                    icon={<EventIcon fontSize="small" />}
                    label={`Due: ${fmtDate(selectedProject.dueDate)}`}
                    sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "inherit" }}
                  />
                  <Chip
                    size="small"
                    label={selectedProject.status}
                    color="default"
                    sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "inherit" }}
                  />
                  <Chip
                    size="small"
                    icon={<FlagIcon fontSize="small" />}
                    label={`Priority: ${selectedProject.priority}`}
                    sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "inherit" }}
                  />
                </Stack>
              </Paper>

              {/* Summary & basic info */}
              <Grid container spacing={1.2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Project summary</Typography>
                  <Paper sx={{ p: 1.2, borderRadius: 2 }} variant="outlined">
                    <Typography variant="body2">
                      {selectedProject.summary ||
                        selectedProject.description ||
                        "No summary."}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2">Detailed description</Typography>
                  <Paper sx={{ p: 1.2, borderRadius: 2 }} variant="outlined">
                    <Typography variant="body2">
                      {selectedProject.description || "No description."}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 1.2, borderRadius: 2 }} variant="outlined">
                    <Typography variant="caption" color="text.secondary">
                      Client
                    </Typography>
                    <Typography variant="body2">
                      {selectedProject.client || "—"}
                    </Typography>
                    <Box sx={{ mt: 1 }} />
                    <Typography variant="caption" color="text.secondary">
                      Timeline
                    </Typography>
                    <Typography variant="body2">
                      {fmtDate(selectedProject.startDate)} →{" "}
                      {fmtDate(selectedProject.dueDate)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 1.2, borderRadius: 2 }} variant="outlined">
                    <Typography variant="caption" color="text.secondary">
                      Budget
                    </Typography>
                    <Typography variant="body2">
                      {selectedProject.budget
                        ? `${selectedProject.budget.toLocaleString()} DKK`
                        : "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Used
                    </Typography>
                    <Typography variant="body2">
                      {selectedProject.budgetUsed
                        ? `${selectedProject.budgetUsed.toLocaleString()} DKK`
                        : "—"}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Progress */}
              <Box>
                <Typography variant="subtitle2">Progress</Typography>
                <Box sx={{ mt: 0.5 }}>
                  <LinearProgress
                    variant="determinate"
                    value={selectedProject.progress || 0}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {selectedProject.progress || 0}% complete
                  </Typography>
                </Box>
              </Box>

              {/* Tags */}
              {(selectedProject.tags || []).length > 0 && (
                <Box>
                  <Typography variant="subtitle2">Tags</Typography>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ flexWrap: "wrap", mt: 0.5 }}
                  >
                    {selectedProject.tags.map((t) => (
                      <Chip key={t} size="small" label={t} />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Tasks (editable) */}
              <Box>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <TaskAltIcon fontSize="small" />
                  <Typography variant="subtitle2">Tasks</Typography>
                </Stack>
                <Paper sx={{ mt: 0.5, borderRadius: 2 }} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Done</TableCell>
                        <TableCell>Task name</TableCell>
                        <TableCell>Task description</TableCell>
                        <TableCell>Start</TableCell>
                        <TableCell>End</TableCell>
                        <TableCell>Progress %</TableCell>
                        <TableCell>Owner</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(selectedProject.tasks || []).map((t) => (
                        <TableRow key={t.id}>
                          <TableCell width={56}>
                            <Checkbox
                              size="small"
                              checked={!!t.done}
                              onChange={() =>
                                toggleTaskDone(selectedProject.id, t.id)
                              }
                            />
                          </TableCell>
                          <TableCell>{t.title}</TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              multiline
                              minRows={2}
                              value={t.description || ""}
                              onChange={(e) =>
                                updateTaskField(
                                  selectedProject.id,
                                  t.id,
                                  "description",
                                  e.target.value
                                )
                              }
                              sx={{ minWidth: 220 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="date"
                              size="small"
                              value={t.startDate ? fmtDate(t.startDate) : ""}
                              onChange={(e) =>
                                updateTaskField(
                                  selectedProject.id,
                                  t.id,
                                  "startDate",
                                  e.target.value
                                )
                              }
                              InputLabelProps={{ shrink: true }}
                              sx={{ minWidth: 120 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="date"
                              size="small"
                              value={t.endDate ? fmtDate(t.endDate) : ""}
                              onChange={(e) =>
                                updateTaskField(
                                  selectedProject.id,
                                  t.id,
                                  "endDate",
                                  e.target.value
                                )
                              }
                              InputLabelProps={{ shrink: true }}
                              sx={{ minWidth: 120 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              size="small"
                              inputProps={{ min: 0, max: 100 }}
                              value={
                                typeof t.progress === "number"
                                  ? t.progress
                                  : t.done
                                  ? 100
                                  : 0
                              }
                              onChange={(e) => {
                                const val = Math.max(
                                  0,
                                  Math.min(100, Number(e.target.value) || 0)
                                );
                                updateTaskField(
                                  selectedProject.id,
                                  t.id,
                                  "progress",
                                  val
                                );
                              }}
                              sx={{ width: 100 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={t.owner || ""}
                              onChange={(e) =>
                                updateTaskField(
                                  selectedProject.id,
                                  t.id,
                                  "owner",
                                  e.target.value
                                )
                              }
                              sx={{ minWidth: 120 }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      {(selectedProject.tasks || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} align="center">
                            <Box sx={{ py: 1, color: "text.secondary" }}>
                              No tasks yet.
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Paper>
              </Box>

              {/* Quick add task to current project */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Add quick task
                </Typography>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1}
                  alignItems={{ xs: "flex-start", md: "center" }}
                >
                  <TextField
                    size="small"
                    label="Task title"
                    value={taskDraft.title}
                    onChange={(e) =>
                      setTaskDraft((d) => ({ ...d, title: e.target.value }))
                    }
                    sx={{ minWidth: 220 }}
                  />
                  <TextField
                    size="small"
                    label="Owner"
                    value={taskDraft.owner}
                    onChange={(e) =>
                      setTaskDraft((d) => ({ ...d, owner: e.target.value }))
                    }
                    sx={{ minWidth: 140 }}
                  />
                  <TextField
                    type="date"
                    size="small"
                    label="Start"
                    InputLabelProps={{ shrink: true }}
                    value={taskDraft.startDate}
                    onChange={(e) =>
                      setTaskDraft((d) => ({ ...d, startDate: e.target.value }))
                    }
                  />
                  <TextField
                    type="date"
                    size="small"
                    label="End"
                    InputLabelProps={{ shrink: true }}
                    value={taskDraft.endDate}
                    onChange={(e) =>
                      setTaskDraft((d) => ({ ...d, endDate: e.target.value }))
                    }
                  />
                  <TextField
                    type="number"
                    size="small"
                    label="Progress %"
                    inputProps={{ min: 0, max: 100 }}
                    value={taskDraft.progress}
                    onChange={(e) =>
                      setTaskDraft((d) => ({
                        ...d,
                        progress: Number(e.target.value) || 0,
                      }))
                    }
                    sx={{ width: 120 }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addTaskToSelectedProject}
                    sx={{ textTransform: "none" }}
                  >
                    Add task
                  </Button>
                </Stack>
              </Box>

              {/* Notes */}
              <Box>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <NotesIcon fontSize="small" />
                  <Typography variant="subtitle2">Internal Notes</Typography>
                </Stack>
                <Paper sx={{ mt: 0.5, p: 1, borderRadius: 2 }} variant="outlined">
                  <Typography variant="body2">
                    {selectedProject.notes || "No notes added yet."}
                  </Typography>
                </Paper>
              </Box>
            </Stack>
          )}
        </Paper>
      </Stack>

      {/* CREATE/EDIT PROJECT DIALOG */}
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            maxWidth: 1800,
            maxHeight: "90vh",
          },
        }}
      >
        <DialogTitle
          sx={{
            color: "primary.main",
            fontWeight: 600,
          }}
        >
          {editMode ? "Edit Project" : "New Project"}
        </DialogTitle>
        <DialogContent
          sx={{
            pt: 1,
            maxHeight: "75vh",
            overflow: "auto",
          }}
        >
          {dialogProject && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Code"
                    fullWidth
                    value={dialogProject.code}
                    onChange={(e) =>
                      handleDialogFieldChange("code", e.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField
                    label="Project name"
                    fullWidth
                    value={dialogProject.name}
                    onChange={(e) =>
                      handleDialogFieldChange("name", e.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Owner"
                    fullWidth
                    value={dialogProject.owner}
                    onChange={(e) =>
                      handleDialogFieldChange("owner", e.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Client"
                    fullWidth
                    value={dialogProject.client}
                    onChange={(e) =>
                      handleDialogFieldChange("client", e.target.value)
                    }
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      label="Status"
                      value={dialogProject.status}
                      onChange={(e) =>
                        handleDialogFieldChange("status", e.target.value)
                      }
                    >
                      {STATUS_OPTIONS.filter((s) => s.value).map((s) => (
                        <MenuItem key={s.value} value={s.value}>
                          {s.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Priority</InputLabel>
                    <Select
                      label="Priority"
                      value={dialogProject.priority}
                      onChange={(e) =>
                        handleDialogFieldChange("priority", e.target.value)
                      }
                    >
                      {["low", "medium", "high"].map((p) => (
                        <MenuItem key={p} value={p}>
                          {p}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Start"
                    type="date"
                    fullWidth
                    value={fmtDate(dialogProject.startDate)}
                    onChange={(e) =>
                      handleDialogFieldChange("startDate", e.target.value)
                    }
                    InputLabelProps={{ shrink: true }}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Due"
                    type="date"
                    fullWidth
                    value={fmtDate(dialogProject.dueDate)}
                    onChange={(e) =>
                      handleDialogFieldChange("dueDate", e.target.value)
                    }
                    InputLabelProps={{ shrink: true }}
                    size="small"
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Progress %"
                    type="number"
                    fullWidth
                    value={dialogProject.progress}
                    InputProps={{ readOnly: true }}
                    helperText="Auto-calculated from tasks"
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Budget (DKK)"
                    type="number"
                    fullWidth
                    value={dialogProject.budget}
                    onChange={(e) =>
                      handleDialogFieldChange(
                        "budget",
                        Number(e.target.value) || 0
                      )
                    }
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Used (DKK)"
                    type="number"
                    fullWidth
                    value={dialogProject.budgetUsed}
                    onChange={(e) =>
                      handleDialogFieldChange(
                        "budgetUsed",
                        Number(e.target.value) || 0
                      )
                    }
                    size="small"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Tags (comma separated)"
                    fullWidth
                    value={(dialogProject.tags || []).join(", ")}
                    onChange={(e) =>
                      handleDialogFieldChange(
                        "tags",
                        e.target.value
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean)
                      )
                    }
                    size="small"
                  />
                </Grid>

                {/* Project summary + AI */}
                <Grid item xs={12} md={9}>
                  <TextField
                    label="Project summary"
                    fullWidth
                    multiline
                    minRows={3}
                    value={dialogProject.summary || ""}
                    onChange={(e) =>
                      handleDialogFieldChange("summary", e.target.value)
                    }
                  />
                </Grid>
                <Grid
                  item
                  xs={12}
                  md={3}
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    mt: { xs: 1, md: 0 },
                  }}
                >
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={handleAiSuggestSummary}
                    disabled={aiSummaryBusy}
                    sx={{ textTransform: "none" }}
                  >
                    {aiSummaryBusy ? "Generating…" : "AI: Suggest summary"}
                  </Button>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Detailed description"
                    fullWidth
                    multiline
                    minRows={3}
                    value={dialogProject.description}
                    onChange={(e) =>
                      handleDialogFieldChange("description", e.target.value)
                    }
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Internal Notes"
                    fullWidth
                    multiline
                    minRows={2}
                    value={dialogProject.notes}
                    onChange={(e) =>
                      handleDialogFieldChange("notes", e.target.value)
                    }
                  />
                </Grid>

                {/* TASKS INSIDE DIALOG */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mt: 1 }}>
                    Tasks
                  </Typography>
                  <Paper sx={{ mt: 0.5, borderRadius: 2 }} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Done</TableCell>
                          <TableCell sx={{ minWidth: 180 }}>Task name</TableCell>
                          <TableCell sx={{ minWidth: 260 }}>
                            Task description
                          </TableCell>
                          <TableCell sx={{ minWidth: 200 }}>Sub tasks</TableCell>
                          <TableCell>Start</TableCell>
                          <TableCell>End</TableCell>
                          <TableCell>Progress %</TableCell>
                          <TableCell>Owner</TableCell>
                          <TableCell align="right">AI</TableCell>
                          <TableCell align="right">Remove</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(dialogProject.tasks || []).map((t, idx) => (
                          <TableRow key={t.id || idx}>
                            <TableCell>
                              <Checkbox
                                size="small"
                                checked={!!t.done}
                                onChange={() =>
                                  handleDialogTaskToggleDone(idx)
                                }
                              />
                            </TableCell>
                            <TableCell sx={{ minWidth: 180 }}>
                              <TextField
                                size="small"
                                fullWidth
                                value={t.title || ""}
                                onChange={(e) =>
                                  handleDialogTaskFieldChange(
                                    idx,
                                    "title",
                                    e.target.value
                                  )
                                }
                                placeholder="Task name"
                              />
                            </TableCell>
                            <TableCell sx={{ minWidth: 260 }}>
                              <TextField
                                size="small"
                                fullWidth
                                multiline
                                minRows={2}
                                value={t.description || ""}
                                onChange={(e) =>
                                  handleDialogTaskFieldChange(
                                    idx,
                                    "description",
                                    e.target.value
                                  )
                                }
                                placeholder="Describe what should be done"
                              />
                            </TableCell>
                            <TableCell sx={{ minWidth: 200 }}>
                              <TextField
                                size="small"
                                fullWidth
                                value={(t.subTasks || []).join(", ")}
                                onChange={(e) =>
                                  handleDialogTaskFieldChange(
                                    idx,
                                    "subTasks",
                                    e.target.value
                                      .split(",")
                                      .map((x) => x.trim())
                                      .filter(Boolean)
                                  )
                                }
                                placeholder="Sub tasks (comma separated)"
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="date"
                                size="small"
                                value={t.startDate ? fmtDate(t.startDate) : ""}
                                onChange={(e) =>
                                  handleDialogTaskFieldChange(
                                    idx,
                                    "startDate",
                                    e.target.value
                                  )
                                }
                                InputLabelProps={{ shrink: true }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="date"
                                size="small"
                                value={t.endDate ? fmtDate(t.endDate) : ""}
                                onChange={(e) =>
                                  handleDialogTaskFieldChange(
                                    idx,
                                    "endDate",
                                    e.target.value
                                  )
                                }
                                InputLabelProps={{ shrink: true }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                type="number"
                                size="small"
                                inputProps={{ min: 0, max: 100 }}
                                value={
                                  typeof t.progress === "number"
                                    ? t.progress
                                    : t.done
                                    ? 100
                                    : 0
                                }
                                onChange={(e) =>
                                  handleDialogTaskFieldChange(
                                    idx,
                                    "progress",
                                    e.target.value
                                  )
                                }
                                sx={{ width: 80 }}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                value={t.owner || ""}
                                onChange={(e) =>
                                  handleDialogTaskFieldChange(
                                    idx,
                                    "owner",
                                    e.target.value
                                  )
                                }
                                placeholder="Owner"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="AI: Suggest description & sub tasks">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      handleAiSuggestTaskDetails(idx)
                                    }
                                    disabled={aiTaskBusyIndex === idx}
                                  >
                                    <AutoAwesomeIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                onClick={() => handleDialogRemoveTask(idx)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(dialogProject.tasks || []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={10} align="center">
                              <Box sx={{ py: 1, color: "text.secondary" }}>
                                No tasks defined yet.
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    <Box
                      sx={{
                        borderTop: (t) => `1px solid ${t.palette.divider}`,
                        p: 1,
                        textAlign: "right",
                      }}
                    >
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleDialogAddTask}
                      >
                        Add task row
                      </Button>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={dialogProject.status === "completed"}
                    onChange={(e) =>
                      handleDialogFieldChange(
                        "status",
                        e.target.checked ? "completed" : dialogProject.status
                      )
                    }
                  />
                }
                label="Mark as completed"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={saveDialogProject}>
            {editMode ? "Save changes" : "Create project"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* VIEW PROJECT DASHBOARD DIALOG */}
      <Dialog
        open={viewOpen && !!selectedProject}
        onClose={() => setViewOpen(false)}
        maxWidth="xl"
        fullWidth
        fullScreen={fullScreenDashboard}
        PaperProps={{
          sx: {
            maxWidth: 1700,
            maxHeight: "92vh",
          },
        }}
      >
        <DialogTitle>
          {selectedProject
            ? `${selectedProject.name} – Project Dashboard`
            : "Project Dashboard"}
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            maxHeight: "78vh",
            overflow: "auto",
          }}
        >
          {selectedProject && <ProjectDashboard project={selectedProject} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete project?</DialogTitle>
        <DialogContent>
          <Typography>
            This action cannot be undone. Do you really want to delete this
            project?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
