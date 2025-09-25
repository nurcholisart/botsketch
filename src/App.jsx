import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from 'reactflow';
import ReactMarkdown from 'react-markdown';
import { X, FileText, Paperclip, TerminalSquare } from 'lucide-react';
import 'reactflow/dist/style.css';

const defaultEdgeOptions = {
  style: { strokeWidth: 2, stroke: '#000000' },
  animated: false,
};

const nbCard = 'rounded-xl border-[3px] border-black bg-white shadow-[6px_6px_0_0_#000] overflow-hidden';

// --- Node Types ---
const CardNode = ({ data }) => (
  <div className={nbCard + ' w-56'}>
    <div className="px-4 py-3 border-b-[3px] border-black bg-slate-100 rounded-t-xl">
      <p className="text-sm font-semibold text-slate-900">{data.title ?? 'Untitled'}</p>
      {data.subtitle && <p className="text-xs text-slate-600 mt-0.5">{data.subtitle}</p>}
    </div>
    <div className="p-4 text-xs text-slate-700">{data.body ?? 'Drop wires here or connect to another node.'}</div>
    <Handle type="target" position={Position.Left} id="in" className="!bg-black !w-3 !h-3" />
    <Handle type="source" position={Position.Right} id="out" className="!bg-black !w-3 !h-3" />
  </div>
);

const UserMsgNode = ({ data }) => (
  <div className={nbCard + ' w-64 bg-sky-100'}>
    <div className="px-4 py-2 border-b-[3px] border-black bg-sky-300 flex items-center gap-2 rounded-t-xl">
      <span className="inline-flex h-2.5 w-2.5 bg-black" />
      <p className="text-xs font-bold uppercase">User</p>
    </div>
    <div className="p-3 space-y-2 text-xs text-slate-900">
      {data.text && (
        <div className="prose prose-xs max-w-none">
          <ReactMarkdown>{data.text}</ReactMarkdown>
        </div>
      )}
    </div>
    <Handle type="target" position={Position.Left} id="in" className="!bg-black !w-3 !h-3" />
    <Handle type="source" position={Position.Right} id="out" className="!bg-black !w-3 !h-3" />
  </div>
);

const BotMsgNode = ({ data }) => (
  <div className={nbCard + ' w-72 bg-lime-100'}>
    <div className="px-4 py-2 border-b-[3px] border-black bg-lime-300 flex items-center gap-2 rounded-t-xl">
      <span className="inline-flex h-2.5 w-2.5 bg-black" />
      <p className="text-xs font-bold uppercase">Chatbot</p>
    </div>
    <div className="p-3 space-y-2 text-xs text-slate-900">
      {data.text && (
        <div className="prose prose-xs max-w-none">
          <ReactMarkdown>{data.text}</ReactMarkdown>
        </div>
      )}
    </div>
    <Handle type="target" position={Position.Left} id="in" className="!bg-black !w-3 !h-3" />
    <Handle type="source" position={Position.Right} id="out" className="!bg-black !w-3 !h-3" />
  </div>
);

const SystemActionNode = ({ data }) => (
  <div className={nbCard + ' w-64 bg-amber-100'}>
    <div className="px-4 py-2 border-b-[3px] border-black bg-amber-300 flex items-center gap-2 rounded-t-xl">
      <TerminalSquare size={14} />
      <p className="text-xs font-bold uppercase">System Action</p>
    </div>
    <div className="p-3 text-xs text-slate-900">
      {data.text && (
        <div className="prose prose-xs max-w-none">
          <ReactMarkdown>{data.text}</ReactMarkdown>
        </div>
      )}
    </div>
    <Handle type="target" position={Position.Left} id="in" className="!bg-black !w-3 !h-3" />
    <Handle type="source" position={Position.Right} id="out" className="!bg-black !w-3 !h-3" />
  </div>
);

const nodeTypes = Object.freeze({ card: CardNode, user: UserMsgNode, bot: BotMsgNode, system: SystemActionNode });

// --- Initial Graph ---
const initialNodes = [
  { id: 'u1', type: 'user', position: { x: -80, y: 0 }, data: { text: 'Hi, **I want** to check my order status.' } },
  { id: 'b1', type: 'bot', position: { x: 260, y: -10 }, data: { text: 'Sure—please share your `order ID`.' } },
  { id: 's1', type: 'system', position: { x: 600, y: -60 }, data: { text: 'System validates the order ID in database' } },
  { id: 'b2', type: 'bot', position: { x: 900, y: -20 }, data: { text: 'Found it. Your package is *out for delivery* today.' } },
];

const initialEdges = [
  { id: 'e-u1-b1', source: 'u1', target: 'b1', type: 'smoothstep' },
  { id: 'e-b1-s1', source: 'b1', target: 's1', type: 'smoothstep' },
  { id: 'e-s1-b2', source: 's1', target: 'b2', type: 'smoothstep' },
];

// --- Persistence / Share helpers ---
const STORAGE_KEY = 'reactflow:graph';

function sanitizeGraph(parsed) {
  if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error('Invalid graph format: expected nodes and edges arrays');
  }
  const sanitizedNodes = parsed.nodes.map((n, i) => ({
    id: n.id ?? `n${i}`,
    type: n.type ?? 'card',
    position: n.position ?? { x: Math.random() * 600, y: Math.random() * 300 },
    data: n.data ?? {},
  }));
  const sanitizedEdges = parsed.edges.map((e, i) => ({
    id: e.id ?? `e${i}`,
    source: e.source,
    target: e.target,
    type: e.type ?? 'smoothstep',
  }));
  return { nodes: sanitizedNodes, edges: sanitizedEdges };
}

function nextIdFromNodes(nodes, floor = 5) {
  const nums = nodes.map((n) => {
    const m = String(n.id).match(/(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  });
  const maxNum = nums.length ? Math.max(...nums) : 0;
  return Math.max(floor, maxNum + 1);
}

function encodePreset(obj) {
  const json = JSON.stringify(obj);
  try {
    return btoa(unescape(encodeURIComponent(json)));
  } catch {
    // Fallback for environments without unescape
    const utf8 = new TextEncoder().encode(json);
    let bin = '';
    utf8.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  }
}

function decodePreset(b64) {
  try {
    const str = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(str);
  } catch {
    // Fallback path
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const str = new TextDecoder().decode(bytes);
    return JSON.parse(str);
  }
}

// --- Sidebar ---
function Sidebar({ node, onChange, onClose }) {
  if (!node) return null;
  const { data, type } = node;
  return (
    <div className="absolute right-0 top-0 w-80 h-full bg-white border-l-[3px] border-black shadow-[-6px_0_0_0_#000] p-4 overflow-y-auto z-20 flex flex-col">
      <div className="flex justify-between items-center mb-4 border-b pb-2 border-black">
        <h2 className="text-sm font-bold uppercase">Edit {type} Node</h2>
        <button onClick={onClose} className="p-1 border-[2px] border-black bg-red-200 rounded-md hover:bg-red-300">
          <X size={16} />
        </button>
      </div>
      <label className="flex items-center gap-2 text-xs font-bold mb-1"><FileText size={14}/> Text (Markdown)</label>
      <textarea
        className="w-full border-[2px] border-black p-1 text-sm mb-3 rounded-md"
        rows={4}
        value={data.text || ''}
        onChange={(e) => onChange({ text: e.target.value })}
      />
      {type === 'user' && (
        <>
          <label className="flex items-center gap-2 text-xs font-bold mb-1"><Paperclip size={14}/> File URL</label>
          <input
            className="w-full border-[2px] border-black p-1 text-sm mb-3 rounded-md"
            value={data.file || ''}
            onChange={(e) => onChange({ file: e.target.value })}
          />
        </>
      )}
      {type === 'bot' && (
        <>
          <label className="flex items-center gap-2 text-xs font-bold mb-1"><Paperclip size={14}/> Attachment</label>
          <input
            className="w-full border-[2px] border-black p-1 text-sm mb-3 rounded-md"
            value={data.attachment || ''}
            onChange={(e) => onChange({ attachment: e.target.value })}
          />
        </>
      )}
    </div>
  );
}

// --- Toolbar ---
function Toolbar({ onAddUser, onAddBot, onAddSystem, onReset, onExport, onImportClick, onShare }) {
  return (
    <div className={nbCard + ' p-2 bg-white/90 backdrop-blur'}>
      <div className="inline-flex items-center">
        {/* Left group: create + reset */}
        <div className="inline-flex items-center gap-2 pr-3">
          <button onClick={onAddUser} className="border-[3px] border-black bg-sky-200 px-3 py-1.5 text-sm rounded-md shadow-[4px_4px_0_0_#000]">+ User</button>
          <button onClick={onAddBot} className="border-[3px] border-black bg-lime-200 px-3 py-1.5 text-sm rounded-md shadow-[4px_4px_0_0_#000]">+ Bot</button>
          <button onClick={onAddSystem} className="border-[3px] border-black bg-amber-200 px-3 py-1.5 text-sm rounded-md shadow-[4px_4px_0_0_#000]">+ System</button>
          <button onClick={onReset} className="border-[3px] border-black bg-white px-3 py-1.5 text-sm rounded-md shadow-[4px_4px_0_0_#000]">Reset</button>
        </div>
        {/* Divider */}
        <div className="mx-2 h-8 w-[3px] bg-black rounded-sm shadow-[2px_0_0_0_#000]" aria-hidden="true" />
        {/* Right group: export/import/share */}
        <div className="inline-flex items-center gap-2 pl-3">
          <button onClick={onExport} className="border-[3px] border-black bg-white px-3 py-1.5 text-sm rounded-md shadow-[4px_4px_0_0_#000]">Export</button>
          <button onClick={onShare} className="border-[3px] border-black bg-white px-3 py-1.5 text-sm rounded-md shadow-[4px_4px_0_0_#000]">Share</button>
          <button onClick={onImportClick} className="border-[3px] border-black bg-white px-3 py-1.5 text-sm rounded-md shadow-[4px_4px_0_0_#000]">Import</button>
        </div>
      </div>
    </div>
  );
}

function ExportModal({ open, data, onClose }) {
  if (!open) return null;
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(data);
        alert('JSON copied to clipboard');
      } else {
        alert('Clipboard not available. Select and copy manually.');
      }
    } catch (_) {
      alert('Copy failed. Select and copy manually.');
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={nbCard + ' relative w-[680px] max-w-[90vw] bg-white p-4'}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold uppercase">Export JSON</h3>
          <button onClick={onClose} className="px-2 py-1 border-[2px] border-black rounded-md bg-white">Close</button>
        </div>
        <textarea readOnly value={data} className="w-full h-72 border-[2px] border-black rounded-md p-2 text-xs font-mono" />
        <div className="mt-2 flex gap-2">
          <button onClick={copy} className="border-[3px] border-black bg-white px-3 py-1.5 text-sm rounded-md shadow-[4px_4px_0_0_#000]">Copy JSON</button>
          <a href={`data:application/json;charset=utf-8,${encodeURIComponent(data)}`} download={`reactflow-export-${new Date().toISOString().replace(/[:.]/g,'-')}.json`} className="border-[3px] border-black bg-white px-3 py-1.5 text-sm rounded-md shadow-[4px_4px_0_0_#000]">Download</a>
        </div>
      </div>
    </div>
  );
}

function FlowInner() {
  const idRef = useRef(5);
  const fileInputRef = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [rfKey, setRfKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedId), [nodes, selectedId]);

  const onConnect = useCallback((connection) => setEdges((eds) => addEdge({ ...connection, type: 'smoothstep' }, eds)), [setEdges]);

  const onAddUser = useCallback(() => {
    const id = `u${idRef.current++}`;
    setNodes((nds) => [...nds, { id, type: 'user', position: { x: Math.random()*800, y: Math.random()*400 }, data: { text: 'User text…' } }]);
    setSelectedId(id);
  }, [setNodes]);

  const onAddBot = useCallback(() => {
    const id = `b${idRef.current++}`;
    setNodes((nds) => [...nds, { id, type: 'bot', position: { x: Math.random()*800, y: Math.random()*400 }, data: { text: 'Bot reply…' } }]);
    setSelectedId(id);
  }, [setNodes]);

  const onAddSystem = useCallback(() => {
    const id = `s${idRef.current++}`;
    setNodes((nds) => [...nds, { id, type: 'system', position: { x: Math.random()*800, y: Math.random()*400 }, data: { text: 'System action…' } }]);
    setSelectedId(id);
  }, [setNodes]);

  const onReset = useCallback(() => {
    idRef.current = 5;
    setNodes(initialNodes);
    setEdges(initialEdges);
    setRfKey((k) => k + 1);
    setSelectedId(null);
  }, [setNodes, setEdges]);

  // --- Load from preset query or localStorage on mount ---
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const preset = url.searchParams.get('preset');
      if (preset) {
        const parsed = decodePreset(preset);
        const { nodes: n, edges: e } = sanitizeGraph(parsed);
        setNodes(n);
        setEdges(e);
        idRef.current = nextIdFromNodes(n);
        setRfKey((k) => k + 1);
        setSelectedId(null);
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ nodes: n, edges: e, importedAt: new Date().toISOString() })
          );
        } catch {}
        return; // Do not also load from storage
      }
    } catch {}

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const { nodes: n, edges: e } = sanitizeGraph(parsed);
      setNodes(n);
      setEdges(e);
      idRef.current = nextIdFromNodes(n);
      setRfKey((k) => k + 1);
      setSelectedId(null);
    } catch (err) {
      console.warn('Failed to load graph from storage:', err);
    }
  }, [setNodes, setEdges]);

  // --- Persist to localStorage on every change ---
  useEffect(() => {
    try {
      const payload = { nodes, edges, savedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      // Silently ignore quota/availability issues
    }
  }, [nodes, edges]);

  // --- Export / Import ---
  const [showExport, setShowExport] = useState(false);
  const [exportData, setExportData] = useState('');

  const exportJSON = useCallback(() => {
    try {
      const payload = { nodes, edges, exportedAt: new Date().toISOString() };
      const jsonStr = JSON.stringify(payload, null, 2);
      // Direct anchor download
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `reactflow-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      console.log('Attempting download:', a.download, 'url:', url);
      a.click();
      setTimeout(() => { try { document.body.removeChild(a); } catch{} try { URL.revokeObjectURL(url); } catch{} }, 500);

    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed: ' + String(err));
    }
  }, [nodes, edges]);

  const onImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result || '');
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) throw new Error('Invalid file format: missing nodes/edges arrays');
        // Basic sanitization: ensure each node has id & position
        const sanitizedNodes = parsed.nodes.map((n, i) => ({ id: n.id ?? `n${i}`, type: n.type ?? 'card', position: n.position ?? { x: Math.random()*600, y: Math.random()*300 }, data: n.data ?? {} }));
        const sanitizedEdges = parsed.edges.map((e, i) => ({ id: e.id ?? `e${i}`, source: e.source, target: e.target, type: e.type ?? 'smoothstep' }));
        setNodes(sanitizedNodes);
        setEdges(sanitizedEdges);
        // update idRef to avoid id collision: find max numeric suffix
        const nums = sanitizedNodes.map(n => { const m = String(n.id).match(/(\d+)$/); return m ? parseInt(m[1],10) : 0; });
        const maxNum = nums.length ? Math.max(...nums) : 0;
        idRef.current = Math.max(5, maxNum + 1);
        setRfKey(k => k + 1);
        setSelectedId(null);
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ nodes: sanitizedNodes, edges: sanitizedEdges, importedAt: new Date().toISOString() })
          );
        } catch {}
        alert('Import successful');
      } catch (err) {
        console.error('Import error', err);
        alert('Failed to import file: ' + String(err));
      }
    };
    reader.readAsText(f);
    // clear input so same file can be re-selected later
    e.target.value = '';
  }, [setNodes, setEdges]);

  const onNodeClick = useCallback((_e, node) => setSelectedId(node.id), []);
  const onPaneClick = useCallback(() => setSelectedId(null), []);

  const onSidebarChange = useCallback((patch) => {
    setNodes((nds) => nds.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)));
  }, [selectedId, setNodes]);

  // --- Share ---
  const shareFlow = useCallback(async () => {
    try {
      const payload = { nodes, edges, exportedAt: new Date().toISOString() };
      const b64 = encodePreset(payload);
      const shareUrl = `${window.location.origin}${window.location.pathname}?preset=${encodeURIComponent(b64)}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        alert('Share URL copied to clipboard');
      } else {
        prompt('Copy this URL to share:', shareUrl);
      }
    } catch (err) {
      console.error('Share failed', err);
      alert('Failed to create share URL: ' + String(err));
    }
  }, [nodes, edges]);

  return (
    <div className="relative w-full h-full" style={{ width: '100%', height: '100%' }}>
      <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} style={{ display: 'none' }} />
      <div className="absolute z-10 left-4 top-4">
        <Toolbar onAddUser={onAddUser} onAddBot={onAddBot} onAddSystem={onAddSystem} onReset={onReset} onExport={exportJSON} onImportClick={onImportClick} onShare={shareFlow} />
      </div>
      <Sidebar node={selectedNode} onChange={onSidebarChange} onClose={() => setSelectedId(null)} />
      <ReactFlow
        key={rfKey}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <MiniMap pannable zoomable className="!bg-white/70 !border-[3px] !border-black !rounded-md !shadow-[4px_4px_0_0_#000]" />
        <Controls showInteractive={false} className="!border-[3px] !border-black !rounded-md !bg-white !shadow-[4px_4px_0_0_#000]" />
        <Background gap={20} size={1} color="#000000" />
      </ReactFlow>
      <ExportModal open={showExport} data={exportData} onClose={() => setShowExport(false)} />
    </div>
  );
}

function runSmokeTests() {
  try {
    const nodeIds = new Set(initialNodes.map((n) => n.id));
    initialEdges.forEach((e) => {
      console.assert(nodeIds.has(e.source), `Edge ${e.id} missing source node: ${e.source}`);
      console.assert(nodeIds.has(e.target), `Edge ${e.id} missing target node: ${e.target}`);
    });
    console.assert(typeof nodeTypes.system === 'function', 'nodeTypes.system should exist');
  } catch (err) {
    console.warn('Smoke tests encountered an error:', err);
  }
}

export default function ReactFlowExample() {
  useEffect(() => { runSmokeTests(); }, []);
  return (
    <div className="fixed inset-0 bg-yellow-100 text-black" style={{ width: '100vw', height: '100vh' }}>
      <ReactFlowProvider>
        <FlowInner />
      </ReactFlowProvider>
    </div>
  );
}
