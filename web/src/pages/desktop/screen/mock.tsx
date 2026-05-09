import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useAtomValue } from 'jotai';

import { mouseStyleAtom } from '@/jotai/mouse';
import { videoParametersAtom } from '@/jotai/screen';

const LINES = [
  { text: 'root@nanokvm:~# uname -a', color: '#e5e7eb' },
  { text: 'Linux nanokvm 6.1.31 #1 SMP PREEMPT NanoKVM armv7l GNU/Linux', color: '#9ca3af' },
  { text: 'root@nanokvm:~# cat /etc/nanokvm/version', color: '#e5e7eb' },
  { text: '1.2.14', color: '#9ca3af' },
  { text: 'root@nanokvm:~# ip addr show eth0', color: '#e5e7eb' },
  {
    text: '2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP',
    color: '#9ca3af'
  },
  { text: '    inet 192.168.1.42/24 brd 192.168.1.255 scope global eth0', color: '#6ee7b7' },
  { text: 'root@nanokvm:~# top -bn1 | head -5', color: '#e5e7eb' },
  { text: 'top - 14:32:01 up 3 days,  2:17,  1 user,  load average: 0.12, 0.08, 0.05', color: '#9ca3af' },
  { text: 'Tasks:  87 total,   1 running,  86 sleeping,   0 stopped,   0 zombie', color: '#9ca3af' },
  { text: '%Cpu(s):  2.1 us,  0.8 sy,  0.0 ni, 96.9 id,  0.0 wa', color: '#fbbf24' },
  { text: 'MiB Mem :    503.8 total,    241.2 free,    156.3 used,    106.3 buff/cache', color: '#9ca3af' },
  { text: 'root@nanokvm:~# ', color: '#e5e7eb' },
];

const BG = '#0f1117';
const FONT = '13px "Courier New", monospace';
const LINE_H = 20;
const PAD_X = 16;
const PAD_Y = 20;

export const MockScreen = () => {
  const videoParameters = useAtomValue(videoParametersAtom);
  const mouseStyle = useAtomValue(mouseStyleAtom);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 900;
    canvas.height = 500;

    const ctx = canvas.getContext('2d')!;
    let cursorVisible = true;
    let lastBlink = 0;

    const draw = (ts: number) => {
      if (ts - lastBlink > 530) {
        cursorVisible = !cursorVisible;
        lastBlink = ts;
      }

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = FONT;
      ctx.textBaseline = 'top';

      LINES.forEach((line, i) => {
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, PAD_X, PAD_Y + i * LINE_H);
      });

      if (cursorVisible) {
        const lastLine = LINES[LINES.length - 1];
        const textW = ctx.measureText(lastLine.text).width;
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(PAD_X + textW, PAD_Y + (LINES.length - 1) * LINE_H, 8, 14);
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  const panX = videoParameters.panX ?? 0;
  const panY = videoParameters.panY ?? 0;

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden">
      <canvas
        id="screen"
        ref={canvasRef}
        className={clsx(
          'block min-h-[50vh] min-w-[50vw] max-w-full select-none object-scale-down',
          mouseStyle
        )}
        style={{ transform: `translate(${panX}px, ${panY}px) scale(${videoParameters.scale})` }}
      />
    </div>
  );
};
