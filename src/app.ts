/**
 * Copyright (c) 2024–2025, Daily
 *
 * SPDX-License-Identifier: BSD 2-Clause License
 */

import {
  BotLLMTextData,
  Participant,
  PipecatClient,
  PipecatClientOptions,
  RTVIEvent, RTVIMessage, TranscriptData,
} from '@pipecat-ai/client-js';
import {
  WebSocketTransport,
  TwilioSerializer,
} from '@pipecat-ai/websocket-transport';

// Import the visualizer bridge
import { updateVisualizer } from './Visualizer';

class WebsocketClientApp {
  private static STREAM_SID = 'ws_mock_stream_sid';
  private static CALL_SID = 'ws_mock_stream_sid';

  private rtviClient: PipecatClient | null = null;
  private connectBtn: HTMLButtonElement | null = null;
  private disconnectBtn: HTMLButtonElement | null = null;
  private statusSpan: HTMLElement | null = null;
  private debugLog: HTMLElement | null = null;
  private wsUrlInput: HTMLInputElement | null = null;
  private botAudio: HTMLAudioElement;

  constructor() {
    this.botAudio = document.createElement('audio');
    this.botAudio.autoplay = true;
    document.body.appendChild(this.botAudio);
    this.setupDOMElements();
    this.setupEventListeners();
    
    // Initialize visualizer with no track
    updateVisualizer(null);
  }

  private setupDOMElements(): void {
    this.connectBtn = document.getElementById(
      'connect-btn'
    ) as HTMLButtonElement;
    this.disconnectBtn = document.getElementById(
      'disconnect-btn'
    ) as HTMLButtonElement;
    this.statusSpan = document.getElementById('connection-status');
    this.debugLog = document.getElementById('debug-log');
    this.wsUrlInput = document.getElementById('ws-url-input') as HTMLInputElement;
  }

  private setupEventListeners(): void {
    this.connectBtn?.addEventListener('click', () => this.connect());
    this.disconnectBtn?.addEventListener('click', () => this.disconnect());
  }

  private log(message: string): void {
    if (!this.debugLog) return;
    const entry = document.createElement('div');
    entry.textContent = `${new Date().toISOString()} - ${message}`;
    if (message.startsWith('User: ')) {
      entry.style.color = '#2196F3';
    } else if (message.startsWith('Bot: ')) {
      entry.style.color = '#4CAF50';
    }
    this.debugLog.appendChild(entry);
    this.debugLog.scrollTop = this.debugLog.scrollHeight;
    console.log(message);
  }

  private updateStatus(status: string): void {
    if (this.statusSpan) {
      this.statusSpan.textContent = status;
    }
    this.log(`Status: ${status}`);
  }

  private async emulateTwilioMessages() {
    const connectedMessage = {
      event: 'connected',
      protocol: 'Call',
      version: '1.0.0',
    };

    const websocketTransport = this.rtviClient?.transport as WebSocketTransport;
    void websocketTransport?.sendRawMessage(connectedMessage);

    const startMessage = {
      event: 'start',
      start: {
        streamSid: WebsocketClientApp.STREAM_SID,
        callSid: WebsocketClientApp.CALL_SID,
      },
    };
    void websocketTransport?.sendRawMessage(startMessage);
  }

  setupMediaTracks() {
    if (!this.rtviClient) return;
    const tracks = this.rtviClient.tracks();
    if (tracks.bot?.audio) {
      this.setupAudioTrack(tracks.bot.audio);
    }
  }

  setupTrackListeners() {
    if (!this.rtviClient) return;

    this.rtviClient.on(RTVIEvent.TrackStarted, (track: MediaStreamTrack, participant?: Participant) => {
      if (!participant?.local && track.kind === 'audio') {
        this.setupAudioTrack(track);
      }
    });

    this.rtviClient.on(RTVIEvent.TrackStopped, (track: MediaStreamTrack, participant?: Participant) => {
      this.log(
        `Track stopped: ${track.kind} from ${participant?.name || 'unknown'}`
      );
    });
  }

  private setupAudioTrack(track: MediaStreamTrack): void {
    this.log('Setting up audio track');
    if (
      this.botAudio.srcObject &&
      'getAudioTracks' in this.botAudio.srcObject
    ) {
      const oldTrack = this.botAudio.srcObject.getAudioTracks()[0];
      if (oldTrack?.id === track.id) return;
    }
    this.botAudio.srcObject = new MediaStream([track]);
    
    // Update the visualizer with the new track
    updateVisualizer(track);
  }

  public async connect(): Promise<void> {
    try {
      if (!this.wsUrlInput || !this.wsUrlInput.value) {
        this.log('Error: WebSocket URL cannot be empty.');
        this.updateStatus('Error');
        return;
      }

      const wsUrl = this.wsUrlInput.value.trim();
      this.log(`Attempting to connect to: ${wsUrl}`);

      const startTime = Date.now();
      const ws_opts = {
        serializer: new TwilioSerializer(),
        recorderSampleRate: 8000,
        playerSampleRate: 8000,
        ws_url: wsUrl,
      };

      const RTVIConfig: PipecatClientOptions = {
        transport: new WebSocketTransport(ws_opts),
        enableMic: true,
        enableCam: false,
        callbacks: {
          onConnected: () => {
            this.emulateTwilioMessages();
            this.updateStatus('Connected');
            if (this.connectBtn) this.connectBtn.disabled = true;
            if (this.disconnectBtn) this.disconnectBtn.disabled = false;
          },
          onDisconnected: () => {
            this.updateStatus('Disconnected');
            if (this.connectBtn) this.connectBtn.disabled = false;
            if (this.disconnectBtn) this.disconnectBtn.disabled = true;
            this.log('Client disconnected');
            // Clear visualizer
            updateVisualizer(null);
          },
          onBotReady: (data: any) => {
            this.log(`Bot ready: ${JSON.stringify(data)}`);
            this.setupMediaTracks();
          },
          onUserTranscript: (data: TranscriptData) => {
            if (data.final) {
              this.log(`User: ${data.text}`);
            }
          },
          onBotTranscript: (data: BotLLMTextData) => this.log(`Bot: ${data.text}`),
          onMessageError: (error: RTVIMessage) => console.error('Message error:', error),
          onError: (error: RTVIMessage) => console.error('Error:', error),
        },
      };
      this.rtviClient = new PipecatClient(RTVIConfig);
      this.setupTrackListeners();

      this.log('Initializing devices...');
      await this.rtviClient.initDevices();

      this.log('Connecting to bot...');
      await this.rtviClient.connect();

      const timeTaken = Date.now() - startTime;
      this.log(`Connection complete, timeTaken: ${timeTaken}`);
    } catch (error) {
      this.log(`Error connecting: ${(error as Error).message}`);
      this.updateStatus('Error');
      if (this.rtviClient) {
        try {
          await this.rtviClient.disconnect();
        } catch (disconnectError) {
          this.log(`Error during disconnect: ${disconnectError}`);
        }
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.rtviClient) {
      try {
        await this.rtviClient.disconnect();
        this.rtviClient = null;
        if (
          this.botAudio.srcObject &&
          'getAudioTracks' in this.botAudio.srcObject
        ) {
          this.botAudio.srcObject
            .getAudioTracks()
            .forEach((track) => track.stop());
          this.botAudio.srcObject = null;
        }
        // Clear visualizer
        updateVisualizer(null);
      } catch (error) {
        this.log(`Error disconnecting: ${(error as Error).message}`);
      }
    }
  }
}

declare global {
  interface Window {
    WebsocketClientApp: typeof WebsocketClientApp;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.WebsocketClientApp = WebsocketClientApp;
  new WebsocketClientApp();
});