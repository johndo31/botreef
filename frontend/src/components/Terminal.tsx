import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  lines: string[];
  websocketUrl?: string;
}

export default function Terminal({ lines, websocketUrl }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      theme: {
        background: "#0a0a0a",
        foreground: "#e5e5e5",
        cursor: "#e5e5e5",
      },
      fontSize: 13,
      fontFamily: "JetBrains Mono, Menlo, Monaco, Courier New, monospace",
      convertEol: true,
      disableStdin: !websocketUrl,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    termRef.current = term;

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(containerRef.current);

    // Connect via WebSocket if URL provided
    if (websocketUrl) {
      const ws = new WebSocket(websocketUrl);
      ws.onmessage = (e) => term.write(e.data);
      term.onData((data) => ws.send(data));
      return () => {
        ws.close();
        resizeObserver.disconnect();
        term.dispose();
      };
    }

    return () => {
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [websocketUrl]);

  useEffect(() => {
    if (termRef.current && lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        termRef.current.write(lastLine);
      }
    }
  }, [lines]);

  return (
    <div
      ref={containerRef}
      className="bg-[#0a0a0a] rounded-lg border border-gray-800 h-80"
    />
  );
}
