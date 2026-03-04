import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { X, Copy, Check, Maximize2, Minimize2, Wifi, WifiOff } from 'lucide-react';
import { VM } from '../types';
import '@xterm/xterm/css/xterm.css';

interface TerminalModalProps {
  vm: VM;
  token: string;
  onClose: () => void;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

// Root password is deterministic per VM (for demo)
function getRootPassword(vmId: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#';
  let hash = 0;
  for (let i = 0; i < vmId.length; i++) {
    hash = ((hash << 5) - hash) + vmId.charCodeAt(i);
    hash = hash & hash;
  }
  let pwd = 'Mts@';
  for (let i = 0; i < 8; i++) {
    hash = Math.abs(((hash << 5) - hash) + i * 7);
    pwd += chars[hash % chars.length];
  }
  return pwd;
}

export default function TerminalModal({ vm, token, onClose }: TerminalModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef      = useRef<Terminal | null>(null);
  const fitRef       = useRef<FitAddon | null>(null);
  const wsRef        = useRef<WebSocket | null>(null);

  const [connState, setConnState] = useState<ConnectionState>('connecting');
  const [copied,    setCopied]    = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const rootPassword = getRootPassword(vm.id);

  // ── Copy password ──────────────────────────────────────────────────────────
  const copyPassword = useCallback(() => {
    navigator.clipboard.writeText(rootPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [rootPassword]);

  // ── Resize terminal to fit container ──────────────────────────────────────
  const fitTerminal = useCallback(() => {
    if (fitRef.current && termRef.current) {
      try {
        fitRef.current.fit();
        // Send resize to backend
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols: termRef.current.cols,
            rows: termRef.current.rows,
          }));
        }
      } catch {}
    }
  }, []);

  // ── Main effect: init xterm + WebSocket ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    // Init xterm
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      theme: {
        background:    '#0d1117',
        foreground:    '#c9d1d9',
        cursor:        '#E30611',
        cursorAccent:  '#0d1117',
        black:         '#484f58',
        brightBlack:   '#6e7681',
        red:           '#ff7b72',
        brightRed:     '#ffa198',
        green:         '#3fb950',
        brightGreen:   '#56d364',
        yellow:        '#d29922',
        brightYellow:  '#e3b341',
        blue:          '#58a6ff',
        brightBlue:    '#79c0ff',
        magenta:       '#bc8cff',
        brightMagenta: '#d2a8ff',
        cyan:          '#39c5cf',
        brightCyan:    '#56d4dd',
        white:         '#b1bac4',
        brightWhite:   '#ffffff',
      },
      scrollback: 2000,
      allowTransparency: true,
    });

    const fitAddon      = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);

    fitAddon.fit();

    termRef.current = term;
    fitRef.current  = fitAddon;

    // ── Connect WebSocket ──────────────────────────────────────────────────
    const wsUrl = `ws://localhost:3001/terminal?vmId=${vm.id}&token=${token}`;
    const ws    = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnState('connecting'); // still waiting for shell to be ready
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
          term.write(msg.data);
          // Detect prompt → we're connected
          if (connState !== 'connected') setConnState('connected');
        }
      } catch {
        term.write(event.data);
      }
    };

    ws.onclose = () => {
      setConnState('disconnected');
      term.write('\r\n\x1b[33mConnection closed.\x1b[0m\r\n');
    };

    ws.onerror = () => {
      setConnState('error');
      term.write('\r\n\x1b[31m✗ Connection error. Make sure backend is running.\x1b[0m\r\n');
    };

    // ── Send keystrokes to WebSocket ──────────────────────────────────────
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // ── Resize observer ────────────────────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    if (containerRef.current.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }

    // Window resize
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    // Focus terminal
    setTimeout(() => term.focus(), 100);
    setConnState('connected');

    return () => {
      ws.close();
      term.dispose();
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []); // run once

  // Re-fit when fullscreen changes
  useEffect(() => {
    setTimeout(fitTerminal, 150);
  }, [fullscreen]);

  // ── Status badge ──────────────────────────────────────────────────────────
  const statusBadge = {
    connecting:   { text: 'Подключение...',  cls: 'text-yellow-400 border-yellow-800/50 bg-yellow-900/20', icon: <Wifi size={11} className="animate-pulse" /> },
    connected:    { text: 'Подключено',      cls: 'text-green-400  border-green-800/50  bg-green-900/20',  icon: <Wifi size={11} /> },
    disconnected: { text: 'Отключено',       cls: 'text-gray-400   border-gray-700      bg-gray-800',      icon: <WifiOff size={11} /> },
    error:        { text: 'Ошибка',          cls: 'text-red-400    border-red-800/50    bg-red-900/20',    icon: <WifiOff size={11} /> },
  }[connState];

  const modalClass = fullscreen
    ? 'fixed inset-0 z-50 flex flex-col bg-[#0d1117]'
    : 'fixed inset-4 md:inset-8 lg:inset-x-24 lg:inset-y-12 z-50 flex flex-col bg-[#0d1117] rounded-xl border border-gray-700 shadow-2xl shadow-black/80';

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={modalClass}>

        {/* ── Title bar ── */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800 bg-gray-900/80 shrink-0 rounded-t-xl">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <button onClick={onClose}      className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" title="Закрыть" />
            <div                           className="w-3 h-3 rounded-full bg-yellow-500 opacity-50" />
            <button onClick={() => setFullscreen(f => !f)} className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors" title="На весь экран" />
          </div>

          {/* VM info */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-semibold text-white truncate">
              root@{vm.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}
            </span>
            <span className="text-xs text-gray-500 font-mono">{vm.ip}</span>
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${statusBadge.cls}`}>
              {statusBadge.icon}
              {statusBadge.text}
            </span>
          </div>

          {/* Password */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1">
              <span className="text-xs text-gray-500">root pass:</span>
              <span className="text-xs font-mono text-yellow-300 select-all">{rootPassword}</span>
              <button
                onClick={copyPassword}
                className={`p-0.5 rounded transition-colors ${copied ? 'text-green-400' : 'text-gray-400 hover:text-white'}`}
                title="Скопировать пароль"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>

            {/* Fullscreen toggle */}
            <button
              onClick={() => setFullscreen(f => !f)}
              className="p-1.5 text-gray-500 hover:text-white transition-colors rounded"
              title={fullscreen ? 'Свернуть' : 'Развернуть'}
            >
              {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            {/* Close */}
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded" title="Закрыть">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* VM specs bar */}
        <div className="flex items-center gap-4 px-4 py-1.5 bg-gray-900/40 border-b border-gray-800/50 text-xs text-gray-500 shrink-0">
          <span>OS: <span className="text-gray-300">{vm.os}</span></span>
          <span>CPU: <span className="text-gray-300">{vm.cpu} vCPU</span></span>
          <span>RAM: <span className="text-gray-300">{vm.ram} GB</span></span>
          <span>Disk: <span className="text-gray-300">{vm.disk} GB</span></span>
          <span className="ml-auto text-gray-600">Ctrl+C interrupt · ↑↓ history · Tab autocomplete</span>
        </div>

        {/* ── xterm.js container ── */}
        <div className="flex-1 overflow-hidden p-1" style={{ background: '#0d1117' }}>
          <div
            ref={containerRef}
            className="w-full h-full"
            style={{ background: '#0d1117' }}
          />
        </div>
      </div>
    </div>
  );
}
