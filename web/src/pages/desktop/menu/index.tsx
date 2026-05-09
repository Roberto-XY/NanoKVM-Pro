import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Divider } from 'antd';
import clsx from 'clsx';
import { useAtomValue, useSetAtom } from 'jotai';
import { GripVerticalIcon } from 'lucide-react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import { useMediaQuery } from 'react-responsive';

import * as api from '@/api/vm.ts';
import * as storage from '@/lib/localstorage.ts';
import { menuDisabledItemsAtom } from '@/jotai/settings.ts';
import { useMenuBounds } from '@/hooks/useMenuBounds.ts';
import { useMenuVisibility } from '@/hooks/useMenuVisibility.ts';

import { AIAssistant } from './assistant';
import { Fullscreen } from './fullscreen';
import { Image } from './image';
import { Keyboard } from './keyboard';
import { Microphone } from './microphone';
import { Mouse } from './mouse';
import { Collapse, Expand } from './operations';
import { Power } from './power';
import { Screen } from './screen';
import { Script } from './script';
import { Settings } from './settings';
import { Terminal } from './terminal';
import { Volume } from './volume';
import { Wol } from './wol';

export const Menu = () => {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const menuDisabledItems = useAtomValue(menuDisabledItemsAtom);
  const setMenuDisabledItems = useSetAtom(menuDisabledItemsAtom);

  const [isInitialized, setIsInitialized] = useState(false);
  const [scale, setScale] = useState(1);

  const isMobile = useMediaQuery({ maxWidth: 639 });

  const { isMenuExpanded, isMenuHidden, handleHovered, handleMoved, setIsMenuExpanded } =
    useMenuVisibility();

  const menuBounds = useMenuBounds(nodeRef, isMenuExpanded);

  const calculateScale = useCallback(() => {
    if (!barRef.current || !isMenuExpanded) return;
    const naturalWidth = barRef.current.scrollWidth;
    const available = window.innerWidth - 16;
    setScale(Math.min(1, available / naturalWidth));
  }, [isMenuExpanded]);

  useLayoutEffect(() => {
    calculateScale();
  }, [calculateScale, menuDisabledItems]);

  useEffect(() => {
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [calculateScale]);

  useEffect(() => {
    api
      .getMenuBarConfig()
      .then((rsp) => {
        if (rsp.code === 0 && rsp.data?.disabledItems?.length) {
          setMenuDisabledItems(rsp.data.disabledItems);
          return;
        }

        // compatible with old versions
        const items = storage.getMenuDisabledItems();
        setMenuDisabledItems(items);
      })
      .finally(() => {
        setIsInitialized(true);
      });
  }, [setMenuDisabledItems]);

  function onDragStop(_e: DraggableEvent, data: DraggableData) {
    if (data.x === 0 && data.y === 0) return;
    handleMoved();
  }

  function isEnabled(item: string) {
    return !menuDisabledItems.includes(item);
  }

  return (
    <Draggable
      nodeRef={nodeRef}
      bounds={menuBounds}
      handle="strong"
      positionOffset={{ x: '-50%', y: '0%' }}
      onStop={onDragStop}
      disabled={isMobile}
    >
      <div
        ref={nodeRef}
        className={clsx(
          'fixed left-1/2 z-[1000] -translate-x-1/2 transition-opacity duration-300',
          isInitialized ? 'opacity-100' : 'opacity-0'
        )}
        style={{ top: 'max(10px, env(safe-area-inset-top))' }}
        onMouseEnter={() => handleHovered(true)}
        onMouseLeave={() => handleHovered(false)}
        onBlur={() => handleHovered(false)}
      >
        {/* Trigger area for auto-show when hidden */}
        {isMenuExpanded && (
          <div className="absolute -top-[10px] left-0 right-0 h-[46px] w-full bg-transparent" />
        )}

        {/* Menubar */}
        <div className="sticky top-[10px] flex w-full justify-center">
          {/* Scale wrapper: shrinks bar to fit viewport on narrow screens */}
          <div ref={barRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
            <div
              className={clsx(
                'h-[44px] items-center rounded bg-neutral-800/80 pl-1 pr-2 transition-all duration-300',
                isMenuExpanded ? 'flex' : 'hidden',
                isMenuHidden ? '-translate-y-[110%] opacity-80' : 'translate-y-0 opacity-100'
              )}
            >
              <strong>
                <div className="flex h-[30px] cursor-move select-none items-center justify-center pl-1 text-neutral-500">
                  <GripVerticalIcon size={18} />
                </div>
              </strong>
              <Divider type="vertical" />

              <Screen />
              {isEnabled('volume') && <Volume />}
              {isEnabled('microphone') && <Microphone />}
              {['volume', 'microphone'].some(isEnabled) && <Divider type="vertical" />}

              <Keyboard />
              <Mouse />
              <Divider type="vertical" />

              {isEnabled('image') && <Image />}
              {isEnabled('script') && <Script />}
              {isEnabled('assistant') && <AIAssistant />}
              {isEnabled('terminal') && <Terminal />}
              {isEnabled('wol') && <Wol />}

              {['image', 'script', 'assistant', 'terminal', 'wol'].some(isEnabled) && (
                <Divider type="vertical" />
              )}

              {isEnabled('power') && (
                <>
                  <Power />
                  <Divider type="vertical" />
                </>
              )}

              <Settings />
              {isEnabled('fullscreen') && <Fullscreen />}
              {isEnabled('collapse') && <Collapse toggleMenu={setIsMenuExpanded} />}
            </div>
          </div>
        </div>

        {/* Menubar expand button */}
        {!isMenuExpanded && <Expand toggleMenu={setIsMenuExpanded} />}
      </div>
    </Draggable>
  );
};
