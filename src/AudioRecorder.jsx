import React, { useRef, useState, useEffect } from 'react';

function AudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState('');
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    // Cleanup function to revoke object URL and stop media streams when component unmounts
    return () => {
      if (audioURL) {
        URL.revokeObjectURL(audioURL);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [audioURL]);

  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (err) {
      let message = 'Failed to access microphone. Please try again.';
      if (err && typeof err === 'object') {
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          message =
            'Microphone access was denied. Please allow microphone permissions in your browser settings and try again.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message =
            'No microphone was found. Please connect a microphone or ensure it is enabled, then try again.';
        } else if (err.name === 'NotSupportedError') {
          message =
            'Microphone recording is not supported with the current browser or settings. Please try a different browser or update your settings.';
        }
      }
      setError(message);
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setRecording(false);
      
      // Stop all media stream tracks to release microphone access
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <button
        onClick={recording ? stopRecording : startRecording}
        aria-pressed={recording}
        aria-label={recording ? 'Stop audio recording' : 'Start audio recording'}
      >
        {recording ? 'Stop Recording' : 'Start Recording'}
      </button>
      {error && (
        <div
          style={{ color: 'red', marginTop: 16 }}
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}
      {audioURL && <audio src={audioURL} controls style={{ display: 'block', marginTop: 16 }} />}
    </div>
  );
}

export default AudioRecorder;
