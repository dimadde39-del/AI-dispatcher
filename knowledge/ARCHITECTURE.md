# Architecture

## Layered Structure

Use this structure once product code begins:

- `src/domain`: pure business types, entities, enums, value objects, and policies.
- `src/application`: use cases, orchestration, ports, and application services.
- `src/infrastructure`: Supabase repositories, Telegram adapter, Vapi adapter, provider clients, persistence mappers.
- `src/interfaces`: provider-neutral ports and DTOs when shared across app and infrastructure boundaries.
- `src/app/api`: thin route handlers for HTTP/webhook entry points.
- `src/app/admin`: internal admin UI for operations.

## Boundary Rules

- Route handlers parse requests, authenticate, call use cases, and format responses.
- React components must not query Supabase directly.
- Domain and application code must not import provider SDKs.
- Infrastructure adapts provider-specific payloads to application-level commands and events.
- Raw provider payloads must be saved for debugging before normalization.
- External inputs must be validated with explicit TypeScript types and Zod schemas when the stack supports them.

## Core Entities

- `Master`: service provider receiving leads.
- `AssistantProfile`: AI behavior and call script configuration for a master or segment.
- `AiNumber`: phone number assigned for forwarding or AI answering.
- `Call`: inbound forwarded call and provider lifecycle state.
- `Lead`: extracted customer request that can be accepted by a master.
- `LeadEvent`: state transition or operational note for a lead.
- `TelegramMessage`: outbound or inbound Telegram interaction metadata.
- `Subscription`: commercial access state for a master or account.
- `ValueReport`: periodic report showing captured leads and saved value.
- `AuditLog`: immutable record of important operational changes.

## Status Enums

- `MasterStatus`: `pending`, `active`, `paused`, `blocked`.
- `LeadStatus`: `new`, `sent`, `accepted`, `declined`, `expired`, `failed`.
- `CallStatus`: `received`, `in_progress`, `completed`, `failed`, `abandoned`.
- `AiNumberStatus`: `available`, `assigned`, `forwarding_active`, `paused`, `retired`.
- `SubscriptionStatus`: `trialing`, `active`, `past_due`, `paused`, `canceled`.

## Provider Abstraction Principles

- Voice providers implement a `VoiceProvider` port.
- Telegram implements a notification or `MasterInterface` port.
- Supabase repositories implement application repository ports.
- Provider IDs should be stored but not used as domain identities.
- Use cases should work with normalized commands, events, and entities.
- Adapters should be replaceable without changing domain rules.

## Initial Data Flow

1. Provider webhook arrives at `src/app/api`.
2. Route validates request and calls an application use case.
3. Infrastructure stores raw payload and normalized call or message state.
4. Application use case creates or updates `Call`, `Lead`, and `LeadEvent`.
5. Telegram adapter sends a lead card through a master-interface port.
6. Callback webhook updates lead status through an idempotent use case.
