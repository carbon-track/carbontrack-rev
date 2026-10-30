import { useEffect, useMemo, useRef, useState } from 'react';

const SPEECH_DURATION_MS = 4500;
const FIRST_DELAY_MS = [10000, 22000];
const REPEAT_DELAY_MS = [25000, 55000];
const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
const randomDelay = ([minimum, maximum]) => minimum + Math.random() * (maximum - minimum);

// Add avatarQuotes to a member in both about locales to give them their own lines.
export function useTeamAvatarSpeech(avatarMembers) {
  const navigationRef = useRef(null);
  const [activeSpeech, setActiveSpeech] = useState(null);
  const speakers = useMemo(() => avatarMembers.flatMap(({ member, index }) => {
    const quotes = Array.isArray(member.avatarQuotes)
      ? member.avatarQuotes.filter((quote) => typeof quote === 'string' && quote.trim())
      : [];
    return quotes.length ? [{ index, quotes }] : [];
  }), [avatarMembers]);

  useEffect(() => {
    setActiveSpeech(null);
    if (!navigationRef.current || !speakers.length) return;

    const visibleSpeakers = new Set();
    let nextTimeout = null;
    let hideTimeout = null;
    let currentSpeaker = null;
    let previousSpeaker = null;
    let hasSpoken = false;
    let sequence = 0;

    const clearTimers = () => {
      window.clearTimeout(nextTimeout);
      window.clearTimeout(hideTimeout);
      nextTimeout = null;
      hideTimeout = null;
    };

    const pause = () => {
      clearTimers();
      if (currentSpeaker !== null) setActiveSpeech(null);
      currentSpeaker = null;
    };

    const schedule = () => {
      if (document.hidden || !visibleSpeakers.size || nextTimeout !== null || hideTimeout !== null) return;

      nextTimeout = window.setTimeout(() => {
        nextTimeout = null;
        if (document.hidden || !visibleSpeakers.size) return;

        const available = speakers.filter(({ index }) => visibleSpeakers.has(index));
        // When more people have lines, let a different teammate speak next.
        const alternatives = available.filter(({ index }) => index !== previousSpeaker);
        const speaker = randomItem(alternatives.length ? alternatives : available);
        currentSpeaker = speaker.index;
        previousSpeaker = speaker.index;
        hasSpoken = true;
        sequence += 1;
        setActiveSpeech({ index: speaker.index, quote: randomItem(speaker.quotes), id: sequence });

        hideTimeout = window.setTimeout(() => {
          hideTimeout = null;
          currentSpeaker = null;
          setActiveSpeech(null);
          schedule();
        }, SPEECH_DURATION_MS);
      }, randomDelay(hasSpoken ? REPEAT_DELAY_MS : FIRST_DELAY_MS));
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const index = Number(entry.target.dataset.teamMemberIndex);
        if (entry.isIntersecting && entry.intersectionRatio >= 0.9) {
          visibleSpeakers.add(index);
        } else {
          visibleSpeakers.delete(index);
        }
      });

      if (!visibleSpeakers.size || (currentSpeaker !== null && !visibleSpeakers.has(currentSpeaker))) {
        pause();
      }
      schedule();
    }, { threshold: 0.9 });

    speakers.forEach(({ index }) => {
      const avatar = navigationRef.current.querySelector(`[data-team-member-index="${index}"]`);
      if (avatar) observer.observe(avatar);
    });

    const handleVisibilityChange = () => {
      if (document.hidden) pause();
      else schedule();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimers();
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [speakers]);

  return { navigationRef, activeSpeech, dismissSpeech: () => setActiveSpeech(null) };
}
