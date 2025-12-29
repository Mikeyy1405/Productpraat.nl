"""
Event Stream Memory - Manus.im append-only pattern
Maintains context of all actions and observations
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from collections import deque

logger = logging.getLogger(__name__)


class EventStream:
    """
    Append-only event stream for maintaining agent context.
    Implements Manus.im's memory pattern.
    """

    def __init__(self, max_events: int = 1000):
        self.events: deque = deque(maxlen=max_events)
        self.max_events = max_events

    def add_event(self, event: Dict[str, Any]):
        """
        Add event to stream.
        Events are never modified after adding (append-only).
        """
        if "timestamp" not in event:
            event["timestamp"] = datetime.now().isoformat()

        self.events.append(event)
        logger.debug(f"Event added: {event.get('type', 'unknown')}")

    def get_recent(self, n: int = 10) -> List[Dict]:
        """Get the N most recent events."""
        return list(self.events)[-n:]

    def get_by_type(self, event_type: str) -> List[Dict]:
        """Get all events of a specific type."""
        return [e for e in self.events if e.get("type") == event_type]

    def get_all(self) -> List[Dict]:
        """Get all events."""
        return list(self.events)

    def count(self) -> int:
        """Get total event count."""
        return len(self.events)

    def clear(self):
        """Clear all events (use with caution)."""
        self.events.clear()
        logger.info("Event stream cleared")

    def get_summary(self) -> Dict[str, Any]:
        """Get summary statistics of event stream."""
        types = {}
        for event in self.events:
            event_type = event.get("type", "unknown")
            types[event_type] = types.get(event_type, 0) + 1

        return {
            "total_events": len(self.events),
            "event_types": types,
            "first_event": self.events[0] if self.events else None,
            "last_event": self.events[-1] if self.events else None
        }
