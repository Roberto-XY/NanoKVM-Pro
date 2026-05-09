import { Image } from 'antd';
import clsx from 'clsx';
import { useAtomValue } from 'jotai';

import MonitorXIcon from '@/assets/images/monitor-x.svg';
import { getBaseUrl } from '@/lib/service.ts';
import { mouseStyleAtom } from '@/jotai/mouse.ts';
import { videoParametersAtom } from '@/jotai/screen.ts';

export const Mjpeg = () => {
  const videoParameters = useAtomValue(videoParametersAtom);
  const mouseStyle = useAtomValue(mouseStyleAtom);

  const panX = videoParameters.panX ?? 0;
  const panY = videoParameters.panY ?? 0;

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden">
      <Image
        id="screen"
        className={clsx(
          'block max-h-full min-h-[50vh] min-w-[50vw] select-none object-scale-down',
          mouseStyle
        )}
        style={{ transform: `translate(${panX}px, ${panY}px) scale(${videoParameters.scale})` }}
        src={`${getBaseUrl('http')}/api/stream/mjpeg`}
        fallback={MonitorXIcon}
        preview={false}
      />
    </div>
  );
};
