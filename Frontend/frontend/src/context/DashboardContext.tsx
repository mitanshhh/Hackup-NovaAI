"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type ProjectStatus = "processing" | "ready" | "error";

export type Project = {
  id: string;
  name: string;
  csvUploaded: boolean;
  status: ProjectStatus;
  createdAt: number;
};

export type Message = {
  id: string;
  role: "user" | "agent";
  content: string;
  jsonLog?: string;
};

interface DashboardContextType {
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  messages: Record<string, Message[]>;
  isRightPanelOpen: boolean;
  setIsRightPanelOpen: (val: boolean) => void;
  setActiveProjectId: (id: string | null) => void;
  addProject: (name: string) => Promise<void>;
  uploadCSV: (projectId: string, csvFile: File) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  
  // Threat Analysis
  threatReport: any;
  isThreatLoading: boolean;
  runThreatSweep: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('insights_messages');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  
  // Threat Analysis Storage (Keyed by project ID)
  const [threatReports, setThreatReports] = useState<Record<string, any>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('insights_threat_reports');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [isThreatLoading, setIsThreatLoading] = useState(false);

  // Auto-persist to localStorage
  useEffect(() => {
    localStorage.setItem('insights_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('insights_threat_reports', JSON.stringify(threatReports));
  }, [threatReports]);
  
  const threatReport = activeProjectId ? threatReports[activeProjectId] : null;

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const normalized = data.map((p: any) => ({
          ...p,
          csvUploaded: !!p.csvUploaded
        }));
        setProjects(normalized);
        if (normalized.length > 0 && !activeProjectId) {
          setActiveProjectId(normalized[0].id);
        }
      }
    } catch (e) {
      console.error("Error fetching projects:", e);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  const addProject = async (name: string) => {
    try {
      const res = await fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(prev => [data, ...prev]);
        setActiveProjectId(data.id);
      }
    } catch (e) {
      console.error("Error creating project:", e);
    }
  };

  // ── Upload CSV for a project ──────────────────────────────────────────────
  const uploadCSV = async (projectId: string, csvFile: File) => {
    // Set status to processing
    setProjects(prev =>
      prev.map(p => p.id === projectId ? { ...p, status: "processing" } : p)
    );

    try {
      const formData = new FormData();
      formData.append("project_id", projectId);
      formData.append("csv", csvFile);

      const res = await fetch("/api/upload-csv", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await res.json();
      const newStatus: ProjectStatus = res.ok ? "ready" : "error";
      
      setProjects(prev =>
        prev.map(p => p.id === projectId ? { ...p, status: newStatus, csvUploaded: true } : p)
      );
      
      // Clear threat report for THIS project since new data was uploaded
      setThreatReports(prev => ({ ...prev, [projectId]: null }));
    } catch (err) {
      setProjects(prev =>
        prev.map(p => p.id === projectId ? { ...p, status: "error" } : p)
      );
    }
  };

  // ── Run Threat Sweep (Analysis) ──────────────────────────────────────────
  const runThreatSweep = React.useCallback(async () => {
    const pId = activeProjectId; // Capture current ID
    if (!activeProject?.csvUploaded || !pId) return;
    
    setIsThreatLoading(true);
    try {
      console.log(`[DASHBOARD_CONTEXT] Fetching threat sweep for ${pId}...`);
      const res = await fetch("/api/threat/sweep", { credentials: "include" });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server Error (${res.status})`);
      }

      const data = await res.json();
      console.log(`[DASHBOARD_CONTEXT] Response received:`, data);
      
      if (data.error) {
         throw new Error(data.error);
      }
      setThreatReports(prev => ({ ...prev, [pId]: data }));
    } catch (e: any) {
      console.error("[DASHBOARD_CONTEXT] Analysis failed:", e);
      throw e;
    } finally {
      setIsThreatLoading(false);
    }
  }, [activeProject, activeProjectId]);

  const deleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/project/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== id));
        if (activeProjectId === id) setActiveProjectId(null);
      }
    } catch (e) {
      console.error("Error deleting project:", e);
    }
  };

  // ── Send message → real AI query ──────────────────────────────────────────
  const sendMessage = async (content: string) => {
    if (!activeProjectId) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content };
    setMessages(prev => ({
      ...prev,
      [activeProjectId]: [...(prev[activeProjectId] || []), userMsg],
    }));

    // Thinking placeholder
    const thinkingId = (Date.now() + 1).toString();
    const thinkingMsg: Message = { id: thinkingId, role: "agent", content: "⏳ Analysing..." };
    setMessages(prev => ({
      ...prev,
      [activeProjectId]: [...(prev[activeProjectId] || []), thinkingMsg],
    }));

    try {
      // Strict requirement: POST /api/query
      const res = await fetch(`/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question: content }),
      });

      const data = await res.json();
      const answer = data?.answer ?? {};
      const actualAnswer: string  = answer.actual_answer ?? data.message ?? "No response received.";
      const jsonLogs: unknown[]   = answer.json_logs ?? [];

      const agentMsg: Message = {
        id: thinkingId,
        role: "agent",
        content: actualAnswer,
        jsonLog: jsonLogs.length > 0 ? JSON.stringify(jsonLogs, null, 2) : undefined,
      };

      // Replace the thinking placeholder
      setMessages(prev => ({
        ...prev,
        [activeProjectId]: (prev[activeProjectId] || []).map(m =>
          m.id === thinkingId ? agentMsg : m
        ),
      }));
    } catch (err) {
      const errMsg: Message = {
        id: thinkingId,
        role: "agent",
        content: "❌ Network error — could not reach the AI engine.",
      };
      setMessages(prev => ({
        ...prev,
        [activeProjectId]: (prev[activeProjectId] || []).map(m =>
          m.id === thinkingId ? errMsg : m
        ),
      }));
    }
  };

  return (
    <DashboardContext.Provider value={{
      projects, activeProjectId, activeProject, messages,
      isRightPanelOpen, setIsRightPanelOpen,
      setActiveProjectId, addProject, uploadCSV, deleteProject, sendMessage,
      threatReport, isThreatLoading, runThreatSweep
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboard must be used within DashboardProvider");
  return context;
}
