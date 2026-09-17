import { useEffect, useRef, useState } from 'react';
import { TUTOR_CAPABILITIES, TUTOR_MODE_ITEMS } from '../services/tutor';
import { useApp } from '../state/StoreProvider';
import { Badge, Card } from './ui';

/**
 * Tutor UI. It only renders state — all the thinking happens in services/tutor.ts (local
 * rule engine) or services/llm.ts (any OpenAI-compatible model), both behind the same
 * action list, so swapping providers never touches this component.
 */
export function TutorPanel({ route, height = 520 }: { route: string; height?: number }) {
  const { state, actions } = useApp();
  const [prompt, setPrompt] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const messages = state.tutorMessages;
  const pending = messages.some(message => message.pending);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, pending]);

  const send = (text: string, action?: (typeof TUTOR_MODE_ITEMS)[number]['action']) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPrompt('');
    void actions.askTutor(trimmed, action, route);
  };

  return (
    <Card
      title="AI Quantum Tutor"
      subtitle="Answers use your lesson, circuit, gate selection, quantum state and last result"
      actions={
        <>
          <Badge tone={state.settings.aiProvider.mode === 'local' ? 'default' : 'accent'}>
            {state.settings.aiProvider.mode === 'local' ? 'built-in tutor' : state.settings.aiProvider.model}
          </Badge>
          <button className="btn-small btn-ghost" onClick={actions.clearTutor} disabled={messages.length === 0}>
            Clear
          </button>
        </>
      }
    >
      <div className="row tight" style={{ marginBottom: 10 }}>
        {TUTOR_MODE_ITEMS.map(item => (
          <button
            key={item.action}
            className="btn-small"
            onClick={() => send(item.question, item.action)}
            disabled={pending}
            title={item.question}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="chat" ref={scrollRef} style={{ maxHeight: height }}>
        {messages.length === 0 && (
          <div className="msg tutor">
            <p style={{ marginBottom: 6 }}>
              <strong>Ask me about what you are doing.</strong> I can see your current lesson, the circuit you are
              building, the gate you selected, the quantum state, the last simulation result and any failing
              challenge check.
            </p>
            <ul className="list-plain tiny">
              {TUTOR_CAPABILITIES.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {messages.map(message => (
          <div className={`msg ${message.role === 'user' ? 'user' : 'tutor'}`} key={message.id}>
            <div className="row between tiny dim" style={{ marginBottom: 4 }}>
              <span>{message.role === 'user' ? 'You' : message.source === 'remote' ? 'Tutor (remote model)' : 'Tutor'}</span>
              {message.action && <span>{message.action}</span>}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{message.text}</div>
            {message.error && (
              <p className="tiny" style={{ color: 'var(--warn-ink)', margin: '6px 0 0' }}>
                {message.error}
              </p>
            )}
            {message.contextSummary && (
              <details style={{ marginTop: 6 }}>
                <summary className="tiny dim" style={{ cursor: 'pointer' }}>
                  context used for this answer
                </summary>
                <div className="tiny dim">{message.contextSummary}</div>
              </details>
            )}
            {message.followUps && message.followUps.length > 0 && (
              <div className="row tight" style={{ marginTop: 8 }}>
                {message.followUps.map(followUp => (
                  <button key={followUp} className="btn-small" onClick={() => send(followUp)} disabled={pending}>
                    {followUp}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {pending && <div className="msg tutor">…</div>}
      </div>

      <form
        className="chat-input"
        style={{ marginTop: 10 }}
        onSubmit={event => {
          event.preventDefault();
          send(prompt);
        }}
      >
        <textarea
          rows={2}
          value={prompt}
          placeholder="Why did the H gate give approximately 50/50?"
          onChange={event => setPrompt(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send(prompt);
            }
          }}
        />
        <button className="btn-primary" type="submit" disabled={pending || prompt.trim().length === 0}>
          Ask
        </button>
      </form>
    </Card>
  );
}
