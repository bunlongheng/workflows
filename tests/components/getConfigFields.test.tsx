// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { getConfigFields } from '@/components/panels/NodeConfigPanel';

describe('getConfigFields - gmail', () => {
  it('t1 returns optional filter query field', () => {
    const f = getConfigFields('gmail', 'gmail-t1');
    expect(f).toHaveLength(1);
    expect(f[0].key).toBe('query');
    expect(f[0].label).toBe('Filter (optional)');
  });

  it('t2 returns subject field', () => {
    const f = getConfigFields('gmail', 'gmail-t2');
    expect(f.map((x) => x.key)).toEqual(['subject']);
    expect(f[0].label).toBe('Subject contains');
  });

  it('t3 returns from field', () => {
    const f = getConfigFields('gmail', 'gmail-t3');
    expect(f.map((x) => x.key)).toEqual(['from']);
  });

  it('t4 returns body field', () => {
    const f = getConfigFields('gmail', 'gmail-t4');
    expect(f.map((x) => x.key)).toEqual(['body']);
  });

  it('t5 returns search query field', () => {
    const f = getConfigFields('gmail', 'gmail-t5');
    expect(f.map((x) => x.key)).toEqual(['query']);
    expect(f[0].label).toBe('Gmail search query');
  });

  it('a1 returns to + subject fields', () => {
    const f = getConfigFields('gmail', 'gmail-a1');
    expect(f.map((x) => x.key)).toEqual(['to', 'subject']);
  });

  it('a3 returns label field', () => {
    const f = getConfigFields('gmail', 'gmail-a3');
    expect(f.map((x) => x.key)).toEqual(['label']);
  });

  it('a2 (no match) returns empty', () => {
    expect(getConfigFields('gmail', 'gmail-a2')).toEqual([]);
  });
});

describe('getConfigFields - hue', () => {
  it('a1 returns group + duration', () => {
    const f = getConfigFields('hue', 'hue-a1');
    expect(f.map((x) => x.key)).toEqual(['group', 'duration']);
    expect(f[0].type).toBe('text');
  });

  it('a2 returns group + scene', () => {
    const f = getConfigFields('hue', 'hue-a2');
    expect(f.map((x) => x.key)).toEqual(['group', 'scene']);
  });

  it('a3 returns group + state select with on/off/toggle options', () => {
    const f = getConfigFields('hue', 'hue-a3');
    expect(f.map((x) => x.key)).toEqual(['group', 'state']);
    const state = f.find((x) => x.key === 'state')!;
    expect(state.type).toBe('select');
    expect(state.options?.map((o) => o.value)).toEqual(['on', 'off', 'toggle']);
  });

  it('a4 returns group + color + brightness with color type', () => {
    const f = getConfigFields('hue', 'hue-a4');
    expect(f.map((x) => x.key)).toEqual(['group', 'color', 'brightness']);
    expect(f.find((x) => x.key === 'color')!.type).toBe('color');
  });

  it('trigger (no a-match) returns empty', () => {
    expect(getConfigFields('hue', 'hue-t1')).toEqual([]);
  });
});

describe('getConfigFields - youtube', () => {
  it('returns single optional keyword filter for any event', () => {
    const f = getConfigFields('youtube', 'youtube-t1');
    expect(f.map((x) => x.key)).toEqual(['keyword']);
    expect(getConfigFields('youtube', 'youtube-a1').map((x) => x.key)).toEqual(['keyword']);
  });
});

describe('getConfigFields - stickies', () => {
  it('returns folder text + manual checkbox', () => {
    const f = getConfigFields('stickies', 'stickies-a1');
    expect(f.map((x) => x.key)).toEqual(['folder', 'manual']);
    const manual = f.find((x) => x.key === 'manual')!;
    expect(manual.type).toBe('checkbox');
  });
});

describe('getConfigFields - diagram', () => {
  it('returns type select defaulting to sequence', () => {
    const f = getConfigFields('diagram', 'diagram-a1');
    expect(f.map((x) => x.key)).toEqual(['type']);
    expect(f[0].type).toBe('select');
    expect(f[0].defaultValue).toBe('sequence');
    expect(f[0].options?.map((o) => o.value)).toEqual(['sequence', 'flowchart', 'class']);
  });
});

describe('getConfigFields - mindmap', () => {
  it('returns type/line selects + title fields', () => {
    const f = getConfigFields('mindmap', 'mindmap-a1');
    expect(f.map((x) => x.key)).toEqual(['type', 'line', 'title_max', 'title_prefix']);
    expect(f.find((x) => x.key === 'type')!.defaultValue).toBe('logic');
    expect(f.find((x) => x.key === 'line')!.defaultValue).toBe('brace');
    expect(f.find((x) => x.key === 'title_max')!.defaultValue).toBe('30');
  });
});

describe('getConfigFields - claude', () => {
  it('action event returns api_key + model select + prompt', () => {
    const f = getConfigFields('claude', 'claude-a1');
    expect(f.map((x) => x.key)).toEqual(['api_key', 'model', 'prompt']);
    const model = f.find((x) => x.key === 'model')!;
    expect(model.type).toBe('select');
    expect(model.defaultValue).toBe('claude-sonnet-4-6');
  });

  it('non-action event returns only api_key', () => {
    const f = getConfigFields('claude', 'claude-t1');
    expect(f.map((x) => x.key)).toEqual(['api_key']);
  });
});

describe('getConfigFields - openclaw', () => {
  it('a1 returns bot_token + chat_id + message', () => {
    const f = getConfigFields('openclaw', 'openclaw-a1');
    expect(f.map((x) => x.key)).toEqual(['bot_token', 'chat_id', 'message']);
  });

  it('t1 returns only bot_token', () => {
    const f = getConfigFields('openclaw', 'openclaw-t1');
    expect(f.map((x) => x.key)).toEqual(['bot_token']);
  });

  it('fallback (a2) returns only bot_token', () => {
    const f = getConfigFields('openclaw', 'openclaw-a2');
    expect(f.map((x) => x.key)).toEqual(['bot_token']);
  });
});

describe('getConfigFields - unknown integration', () => {
  it('returns empty array', () => {
    expect(getConfigFields('nonexistent', 'foo-t1')).toEqual([]);
    expect(getConfigFields('github', 'github-t1')).toEqual([]);
  });
});
