import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { CircularWaveform } from "@pipecat-ai/voice-ui-kit";

let root: Root | null = null;

export const updateVisualizer = (track: MediaStreamTrack | null) => {
  const container = document.getElementById('waveform-root');
  if (!container) return;

  if (!root) {
    root = createRoot(container);
  }

  root.render(
    <React.StrictMode>
      <div style={{ width: '100%', height: '100%' }}>
         <CircularWaveform
            audioTrack={track}
            isThinking={false}
            color1="#00D3F2"
            color2="#E12AFB"
         />
      </div>
    </React.StrictMode>
  );
};