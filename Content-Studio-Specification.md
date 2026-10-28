# Content Studio

## Product and Technical Specification

**Platform:** Meckury AI\
**Feature:** Content Studio\
**Document status:** Working product specification\
**Version:** 0.1\
**Scope:** Initial MVP and planned evolution

------------------------------------------------------------------------

## 1. Overview

Content Studio is an automated content and video production feature
within **Meckury AI**.

It enables users to configure one or more content channels, define what
those channels publish, and automate the production of finished videos.
A channel can research and select topics, develop scripts, generate
narration and visuals, assemble the assets into a video, and prepare
publishing metadata.

The initial release produces downloadable video files. It does **not**
publish directly to YouTube or other social platforms.

Content Studio is not a separate product or platform. It is one of the
features inside Meckury AI and should reuse the platform's existing
infrastructure wherever possible.

### Product principle

A user should be able to define a channel once and let Content Studio
repeatedly produce content that follows that channel's identity, subject
matter and production preferences---with the appropriate level of user
oversight.

------------------------------------------------------------------------

## 2. Product goals

1.  Make repeatable video production accessible without requiring users
    to operate several separate AI tools.
2.  Allow users to automate content production around a defined channel
    identity.
3.  Give users control over the providers and models used for text,
    images and speech.
4.  Support scheduled, manual and approval-based production.
5.  Produce complete, downloadable MP4 videos.
6.  Preserve scripts, narration, images, storyboards and other
    production assets.
7.  Charge users according to actual usage through the Meckury AI
    wallet.
8.  Build the workflow so that future capabilities---such as
    AI-generated video clips and social publishing---can be added
    without rebuilding the feature.

## 3. Non-goals for the MVP

The first release will not:

-   Publish directly to YouTube, TikTok, Instagram, Facebook or other
    social platforms.
-   Require users to connect social media accounts.
-   Generate every scene as an AI video clip.
-   Promise fully autonomous factual accuracy.
-   Replace the existing Meckury AI generation infrastructure.
-   Operate as a separate platform with a separate wallet or
    authentication system.

The primary MVP deliverable is a finished MP4 that the user can download
and publish independently.

------------------------------------------------------------------------

## 4. Core concepts

### 4.1 Channel

A channel is a reusable content configuration. It defines what the user
wants to produce and how the content should look and sound.

A user may create multiple channels, each with its own niche, audience,
production settings, schedule and visual identity.

### 4.2 Production job

A production job is one attempt to create one piece of content for a
channel. It contains the topic, script, narration, storyboard, generated
assets, render output, metadata, cost records and execution history.

### 4.3 Production assets

Assets are the individual outputs created during production, including:

-   Research notes and source references
-   Topic and title
-   Script
-   Storyboard
-   Narration audio
-   Generated images
-   Background music and sound effects
-   Subtitles
-   Final rendered video
-   Thumbnail and publishing metadata

The final MP4 is the main deliverable, but individual assets should
remain accessible where practical.

### 4.4 Provider and model

A provider is an external AI or media service integrated into Meckury
AI. A model is a specific capability offered by that provider.

Users should select from available, enabled options in the interface.
Provider credentials, routing and internal implementation details remain
managed by Meckury AI.

------------------------------------------------------------------------

## 5. User workflow

At a high level:

1.  The user creates a channel.
2.  The user defines the channel's subject, audience, voice and visual
    identity.
3.  The user selects text, image and text-to-speech providers/models.
4.  The user configures video format, duration, production frequency and
    schedule.
5.  The user chooses how much control they want over production.
6.  The user funds their Meckury AI wallet.
7.  Content Studio checks the available balance before starting a
    scheduled job.
8.  The production pipeline runs.
9.  The user reviews the result if approval is required.
10. The user downloads the finished MP4 and any available individual
    assets.

A user should also be able to start a one-off production manually,
independently of the channel's schedule.

------------------------------------------------------------------------

## 6. Channel configuration

### 6.1 Channel identity

Suggested fields:

  -----------------------------------------------------------------------
  Field                               Description
  ----------------------------------- -----------------------------------
  Channel name                        Name used to identify the channel

  Description                         Short explanation of the channel

  Niche                               Main subject area

  Topics                              Topics the channel should cover

  Excluded topics                     Topics or angles the channel must
                                      avoid

  Target audience                     Intended viewers

  Audience knowledge level            Beginner, intermediate, advanced or
                                      custom

  Language                            Language of the content

  Tone                                Educational, documentary,
                                      conversational, analytical,
                                      entertaining, etc.

  Editorial instructions              Additional channel-specific rules

  Reference channels                  Optional examples of desired
                                      content style
  -----------------------------------------------------------------------

The channel configuration should guide every production job. A generated
topic should not drift outside the channel's niche simply because a
model suggests an attractive idea.

### 6.2 Video settings

  -----------------------------------------------------------------------
  Setting                             Description
  ----------------------------------- -----------------------------------
  Aspect ratio                        9:16 portrait or 16:9 landscape

  Target duration                     Desired video length

  Minimum duration                    Lower duration boundary

  Maximum duration                    Upper duration boundary

  Resolution                          Available output resolution,
                                      subject to the selected render
                                      capability

  Subtitle preference                 Whether subtitles are included

  Subtitle style                      Font, size, placement and visual
                                      treatment

  Background music                    Disabled, selected track or
                                      automatically selected

  Intro/outro                         Optional reusable channel assets

  Logo/watermark                      Optional channel branding
  -----------------------------------------------------------------------

The channel's aspect ratio should be the default for its jobs. A user
may be allowed to override it for an individual production.

Images must be generated or selected with the target aspect ratio in
mind. Avoid generating images in one ratio and relying on aggressive
cropping to fit another.

### 6.3 Voice and narration

Suggested settings:

-   TTS provider
-   TTS model or voice
-   Voice identity
-   Language and accent, where supported
-   Speaking style
-   Speaking speed
-   Pronunciation instructions
-   Optional custom pronunciation dictionary

The selected voice should remain consistent across a channel unless the
user changes it.

### 6.4 Visual identity

Each channel should be able to maintain a recognisable visual style.

Suggested settings:

-   Overall visual aesthetic
-   Colour palette
-   Image style
-   Character or subject consistency instructions
-   Preferred composition
-   Lighting and atmosphere
-   Subtitle design
-   Intro and outro treatment
-   Logo or watermark
-   Background music preference

These settings should be incorporated into image prompts and rendering
decisions. They should not be treated as a replacement for
scene-specific visual instructions.

### 6.5 AI provider settings

The user should be able to select available options from dropdowns for:

-   LLM provider and model
-   Image-generation provider and model
-   TTS provider and model

Only options enabled by the Meckury AI administrator should be
selectable. The interface should show relevant usage or estimated cost
information where available.

Provider selection should use Meckury AI's existing provider integration
layer. Content Studio should not create duplicate integrations for
capabilities the platform already supports.

------------------------------------------------------------------------

## 7. Automation and scheduling

Each channel should have its own automation settings.

### 7.1 Scheduling options

Support:

-   Manual production only
-   Once daily
-   Multiple times per day
-   Selected days of the week
-   Custom schedule, if supported by the scheduling interface

The user chooses the time at which a production job should begin. The
channel's timezone must be explicit and consistently applied.

### 7.2 Production control modes

Each channel should support three modes:

**Fully automatic**

The system selects a topic and completes production without waiting for
user approval, subject to balance, safety and configured limits.

**Approval before production**

The system proposes a topic and/or script and waits for the user to
approve it before continuing.

**Approval checkpoints**

The user selects the stages that require approval. For example, approve
the topic, then the script, then the final video.

The approval model should be configurable without changing the
underlying production pipeline.

### 7.3 Topic history

Content Studio should keep a history of topics used by each channel.
Before proposing a new topic, the system should consider previous topics
and avoid unnecessary repetition.

Users should be able to:

-   View previous topics
-   Mark topics as used or rejected
-   Add topic ideas
-   Exclude a topic or subject
-   Re-run topic selection when a suggestion is unsuitable

A topic library or idea vault can provide additional direction to the
model.

------------------------------------------------------------------------

## 8. Production pipeline

The MVP pipeline uses generated still images, narration and
video-editing effects. AI-generated video clips are a later capability.

### 8.1 Pipeline stages

1.  **Schedule trigger** --- The scheduler identifies a channel due for
    production.
2.  **Eligibility and balance check** --- Confirm that the channel is
    active and sufficient funds can be reserved.
3.  **Topic research and selection** --- Research relevant material
    where appropriate and select a topic consistent with the channel.
4.  **Topic approval** --- Pause if the selected control mode requires
    approval.
5.  **Script generation** --- Create a script within the configured
    duration and editorial requirements.
6.  **Script approval** --- Pause if required.
7.  **Narration generation** --- Convert the approved script into audio.
8.  **Storyboard planning** --- Divide the script into scenes and plan
    visuals around narration segments.
9.  **Image generation** --- Generate the planned images.
10. **Asset validation** --- Confirm that required audio and visual
    assets exist and are usable.
11. **Video rendering** --- Assemble the narration, images, subtitles,
    music and motion effects.
12. **Metadata generation** --- Prepare title, description,
    tags/hashtags and thumbnail where supported.
13. **Final review** --- Wait for user review if configured.
14. **Completion and settlement** --- Mark the job complete, settle
    actual costs and release unused reserved funds.

The pipeline should advance only when the current stage has completed
successfully or has been explicitly approved.

### 8.2 Topic research and selection

The topic stage should use the channel's niche, topic preferences,
exclusions, target audience, editorial instructions and topic history.

For factual or educational content, research should capture source
references and distinguish sourced facts from interpretation. The system
must not invent citations or present unsupported claims as verified
facts.

Where reliable research is unavailable, the job should make that
limitation visible rather than manufacture certainty.

### 8.3 Script generation

The script should be written for spoken delivery, not merely as an
article.

It should account for:

-   Configured duration
-   Target audience
-   Channel tone
-   Narration pace
-   Clear opening and progression
-   Appropriate ending or call to action
-   Factual and editorial requirements

The system should estimate duration from the script's word count and the
selected voice's expected speaking rate.

### 8.4 Storyboard planning

The storyboard is the bridge between the script and visual production.

Each scene should have structured data such as:

  Field                 Description
  --------------------- --------------------------------------------
  Scene number          Position in the video
  Script segment        Words covered by the scene
  Narration start/end   Timing or estimated timing
  Visual description    What the viewer should see
  Image prompt          Detailed prompt sent to the image provider
  Visual style          Scene-specific style instructions
  Target aspect ratio   The channel/job output ratio
  Screen duration       Expected time the image remains visible
  Status                Pending, generating, completed or failed

Storyboard planning should happen before image generation. The number of
images should be determined by the content and pacing, not by an
arbitrary fixed number.

### 8.5 Image generation

Create a persistent image slot for every planned scene before
dispatching image-generation tasks.

Image generation is the main stage that should run concurrently. Each
image slot should be independently trackable and retryable.

A failed image must not force the system to repeat topic research,
script generation or narration generation.

The image stage completes only when every required slot has a valid
image or the job has been stopped according to its failure policy.

### 8.6 Video rendering

The rendering stage assembles the production assets into a finished
video.

MVP rendering should support:

-   Still images
-   Pan and zoom / Ken Burns effects
-   Scene transitions
-   Narration synchronisation
-   Subtitles
-   Background music
-   Optional sound effects
-   Intro and outro
-   Channel logo or watermark
-   Portrait and landscape output

Image duration should follow narration timing and scene pacing. Avoid
stretching one image across an unrelated section of narration simply to
fill time.

FFmpeg is a suitable rendering foundation. Heavy rendering should run in
an appropriate worker environment rather than inside a short-lived
request handler.

### 8.7 Metadata

Generate relevant publishing materials, such as:

-   Video title
-   Description
-   Tags or hashtags
-   Thumbnail
-   Optional short summary

Metadata should be based on the actual finished content, not just the
original topic prompt.

------------------------------------------------------------------------

## 9. Orchestration and reliability

The workflow must be durable. A server restart, deployment or provider
timeout should not cause an entire production job to restart from the
beginning.

### 9.1 Scheduling is not execution

The cron process should only:

1.  Find channels due for production.
2.  Check whether each channel is eligible.
3.  Attempt an atomic balance reservation.
4.  Create a production job.
5.  Dispatch the first stage.

Cron should not execute the full production pipeline itself.

### 9.2 Sequential stages, parallel tasks

Stages should run in sequence. Within the image-generation stage,
individual image tasks can run in parallel.

A coordinator should decide when a stage is complete and advance the
job. Individual workers should not independently advance the whole job,
as this can create duplicate transitions.

### 9.3 Idempotency

Every stage and external task should have an idempotency strategy.
Repeated delivery of the same task must not create duplicate charges,
duplicate assets or duplicate stage transitions.

Before retrying an external request after a timeout, check whether the
provider may already have completed and charged for it.

### 9.4 Retry policy

Retries should be configurable by the administrator and appropriate to
the provider.

For the initial policy:

-   Track every attempt separately.
-   Retry only the failed task where possible.
-   Do not restart successful upstream stages.
-   Stop and notify the user when the configured retry limit is reached.
-   Settle any charges already incurred.
-   Preserve completed assets.

A provider timeout does not necessarily mean that the provider did not
process or charge for the request.

### 9.5 Job recovery

The system should be able to identify jobs that have remained in a
running state beyond an expected duration.

A recovery process should inspect the current stage and task records,
reconcile provider requests where possible, and resume safely. It should
not blindly restart the entire job.

### 9.6 Job states

Suggested job states:

-   `scheduled`
-   `checking_balance`
-   `reserved`
-   `running`
-   `awaiting_approval`
-   `paused`
-   `completed`
-   `failed`
-   `cancelled`

The current stage should be stored separately from the overall job
status.

A paused job is not a failed job. A cancelled job should not be
represented as a failure.

------------------------------------------------------------------------

## 10. Wallet, reservations and usage accounting

Content Studio should use the existing Meckury AI wallet.

### 10.1 Pre-production reservation

Before a scheduled job begins, estimate its maximum expected cost and
reserve the required amount.

For duration-based configuration, use the channel's maximum configured
duration when calculating the initial reservation, unless a more
accurate job-specific estimate is available.

The estimate should consider:

-   LLM input and output usage
-   Research usage, where billable
-   TTS characters or audio duration
-   Number of generated images
-   Image model and resolution
-   Rendering and compute
-   Storage or transfer costs, where billable
-   Expected retries
-   A configurable safety margin

A percentage buffer alone is not enough. Different providers charge
using different units.

### 10.2 Reservation and settlement

Use a ledger-based wallet model rather than relying only on a mutable
balance field.

Track:

-   Available balance
-   Reserved amount per job
-   Actual provider expenditure
-   Released unused reservation
-   Refunds or adjustments

At completion or termination:

1.  Calculate actual recorded expenditure.
2.  Deduct actual expenditure from the reservation.
3.  Release the unused amount to the user's available balance.
4.  Record the settlement in the ledger.

Reservation must be atomic so that simultaneous jobs cannot reserve the
same funds.

### 10.3 Failed jobs

If a job stops after billable work has occurred:

-   Charge the user for legitimate recorded expenditure.
-   Release the unused reservation.
-   Preserve completed assets.
-   Record the failure reason.
-   Notify the user.

If a provider's final charge is not yet known, keep the relevant
execution record open for reconciliation rather than silently treating
the attempt as free.

### 10.4 Cost transparency

The user should be able to see:

-   Estimated job cost before production
-   Reserved amount
-   Actual cost after settlement
-   Cost by production stage
-   Any amount released back to the wallet

------------------------------------------------------------------------

## 11. Review and editing

The user should be able to inspect the production at the checkpoints
enabled for the channel.

Potential review points:

-   Topic
-   Script
-   Storyboard
-   Final video

Where practical, users should be able to edit a script or replace an
image without restarting the entire job.

Changes must invalidate downstream outputs that depend on the edited
material.

For example, editing a script after narration has been generated should
trigger regeneration or revalidation of narration, storyboard alignment,
affected images and the final render. Research and an approved topic can
remain intact.

The system should clearly communicate which stages will need to run
again and what additional cost may be incurred before the user confirms
an expensive regeneration.

------------------------------------------------------------------------

## 12. Suggested interface structure

Content Studio can have its own interface within Meckury AI.

Suggested navigation:

  -----------------------------------------------------------------------
  Area                                Purpose
  ----------------------------------- -----------------------------------
  Dashboard                           Overview of channels, scheduled
                                      jobs, active productions and recent
                                      outputs

  Channels                            Create and manage channel
                                      identities and settings

  Automation                          Configure schedules, production
                                      modes and approval checkpoints

  Production Studio                   Inspect and manage active
                                      production jobs

  Video Library                       Browse completed videos and
                                      production assets

  Wallet / Usage                      View reservations, expenditure and
                                      usage history
  -----------------------------------------------------------------------

### 12.1 Dashboard

Show useful operational information:

-   Active channels
-   Next scheduled productions
-   Jobs in progress
-   Jobs awaiting approval
-   Recently completed videos
-   Failed or paused jobs
-   Recent usage and wallet balance

### 12.2 Channel page

A channel page should bring together its identity, automation settings,
topic history, recent productions and performance-independent production
history.

Do not make the user navigate through unrelated settings pages just to
understand how a channel is configured.

### 12.3 Production detail page

A production detail page should show:

-   Overall job status
-   Current stage
-   Stage timeline
-   Topic and script
-   Storyboard
-   Narration
-   Image slots and generation status
-   Render progress
-   Estimated and actual costs
-   Errors and retry history
-   Review and download actions

The user should be able to distinguish a job waiting for approval from
one that is actively processing.

------------------------------------------------------------------------

## 13. Architecture within Meckury AI

Content Studio should be modular at the feature level while sharing
platform services.

### 13.1 Reuse existing platform infrastructure

Where available, reuse:

-   Meckury AI authentication and user management
-   Wallet and payment infrastructure
-   Existing AI provider integrations
-   Existing generation aliases and routing
-   Storage infrastructure
-   Administrative provider controls
-   Usage and billing records

Do not duplicate a provider integration simply because Content Studio
uses it in a different workflow.

### 13.2 New Content Studio services

Content Studio will need feature-specific capabilities:

-   Channel configuration service
-   Scheduler and job creation
-   Production orchestration
-   Stage and task tracking
-   Storyboard management
-   Image-slot coordination
-   Rendering pipeline
-   Approval management
-   Content and asset library
-   Cost estimation and job settlement

These services can use shared Meckury AI infrastructure without being
tightly coupled to the interface of another feature.

### 13.3 Suggested technology direction

A practical starting point based on the existing platform direction:

  Layer                         Suggested technology
  ----------------------------- --------------------------------------------
  Frontend                      React, TypeScript, Vite
  Deployment                    Vercel
  Database and authentication   Supabase
  Scheduling                    Supabase Cron or an equivalent scheduler
  Lightweight orchestration     Supabase Edge Functions
  Durable task execution        A persistent queue or task system
  Heavy media processing        Runpod workers or suitable compute workers
  Video rendering               FFmpeg
  Asset storage                 Supabase Storage or S3-compatible storage
  Payments                      Existing Meckury AI / Paystack wallet flow

This is a suggested direction, not a requirement to force every
operation into Supabase Edge Functions. Long-running generation and
rendering tasks need execution environments designed for that workload.

------------------------------------------------------------------------

## 14. Suggested data model

The following is a conceptual starting point. Exact table names and
relationships can be adjusted to fit Meckury AI's existing database.

### `content_channels`

Stores each user's channel configuration.

Possible fields:

-   `id`
-   `user_id`
-   `name`
-   `description`
-   `niche`
-   `topics`
-   `excluded_topics`
-   `target_audience`
-   `language`
-   `tone`
-   `editorial_instructions`
-   `visual_identity`
-   `video_settings`
-   `voice_settings`
-   `provider_settings`
-   `automation_settings`
-   `timezone`
-   `is_active`
-   `created_at`
-   `updated_at`

### `content_jobs`

Stores one production job.

Possible fields:

-   `id`
-   `channel_id`
-   `user_id`
-   `status`
-   `current_stage`
-   `topic`
-   `script`
-   `storyboard`
-   `metadata`
-   `aspect_ratio`
-   `target_duration`
-   `estimated_cost`
-   `reserved_amount`
-   `actual_cost`
-   `final_video_url`
-   `failure_reason`
-   `started_at`
-   `completed_at`
-   `created_at`
-   `updated_at`

### `content_job_stages`

Tracks stage execution.

Possible fields:

-   `id`
-   `job_id`
-   `stage_name`
-   `status`
-   `input_data`
-   `output_data`
-   `attempt_count`
-   `started_at`
-   `completed_at`
-   `error_details`

### `content_tasks`

Tracks individual work items dispatched to workers.

Possible fields:

-   `id`
-   `job_id`
-   `stage_id`
-   `task_type`
-   `task_key`
-   `status`
-   `attempt_count`
-   `max_attempts`
-   `provider`
-   `model`
-   `provider_request_id`
-   `estimated_cost`
-   `actual_cost`
-   `input_data`
-   `output_data`
-   `error_details`
-   `created_at`
-   `updated_at`

### `content_image_slots`

Tracks each planned scene image independently.

Possible fields:

-   `id`
-   `job_id`
-   `scene_number`
-   `script_segment`
-   `prompt`
-   `provider`
-   `model`
-   `aspect_ratio`
-   `status`
-   `asset_url`
-   `attempt_count`
-   `actual_cost`
-   `provider_request_id`
-   `error_details`
-   `created_at`
-   `updated_at`

### `content_assets`

Stores or references production assets.

Possible fields:

-   `id`
-   `job_id`
-   `channel_id`
-   `asset_type`
-   `storage_path`
-   `public_url` or signed-access reference
-   `mime_type`
-   `file_size`
-   `metadata`
-   `created_at`

### `content_topic_history`

Tracks topics proposed, approved, rejected or produced for a channel.

Possible fields:

-   `id`
-   `channel_id`
-   `job_id`
-   `topic`
-   `status`
-   `notes`
-   `created_at`

### `content_approvals`

Tracks approval checkpoints.

Possible fields:

-   `id`
-   `job_id`
-   `stage_name`
-   `status`
-   `submitted_data`
-   `reviewed_by`
-   `reviewed_at`
-   `feedback`
-   `created_at`

### Wallet ledger integration

Use the existing Meckury AI wallet ledger if it supports reservations
and settlements. If it does not, extend it in a way that preserves a
clear audit trail.

Every reservation and settlement should reference the associated
`content_job_id`.

------------------------------------------------------------------------

## 15. Security and operational controls

-   Users must only access their own channels, jobs and assets unless an
    explicit sharing feature is introduced.
-   Enforce access control at the database and storage layers, not only
    in the frontend.
-   Keep provider API keys and secrets on the server side.
-   Validate user-supplied prompts and uploaded assets.
-   Apply sensible limits to duration, image count, file size and
    concurrent jobs.
-   Allow administrators to enable or disable providers and models.
-   Record provider errors and cost data without exposing secrets.
-   Make cancellation safe and prevent new tasks from being dispatched
    after a job is cancelled.
-   Ensure workers verify job and task state before performing billable
    work.

------------------------------------------------------------------------

## 16. Failure scenarios to design for

  -----------------------------------------------------------------------
  Scenario                            Expected behaviour
  ----------------------------------- -----------------------------------
  Insufficient wallet balance         Do not start production; explain
                                      the shortfall

  Provider request times out          Reconcile provider status before
                                      retrying where possible

  One image fails                     Retry that image slot only

  All image slots complete            Coordinator advances to
                                      validation/rendering

  Worker restarts                     Resume from durable task and stage
                                      records

  User cancels job                    Stop dispatching new work and
                                      settle incurred costs

  User edits script                   Invalidate dependent outputs,
                                      preserve unaffected work

  Rendering fails                     Retry rendering without
                                      regenerating all source assets

  Approval is pending                 Keep the job awaiting approval; do
                                      not treat it as failed

  Provider is disabled                Prevent new tasks using it and
                                      handle affected jobs safely

  Actual cost exceeds estimate        Apply defined limits and
                                      safeguards; do not allow unbounded
                                      spending
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 17. MVP scope and delivery phases

### Phase 1 --- Channel setup and manual production

Build:

-   Channel creation and configuration
-   Text, image and TTS provider/model selection
-   Portrait and landscape settings
-   Manual job creation
-   Topic and script generation
-   TTS narration
-   Storyboard generation
-   Image generation
-   Basic image-and-audio video rendering
-   MP4 download
-   Production history and asset storage
-   Basic cost tracking

The first working version should prove that one channel can reliably
produce one complete downloadable video.

### Phase 2 --- Automation and approvals

Add:

-   Scheduled production
-   Multiple channels
-   Fully automatic mode
-   Topic/script/final-video approval checkpoints
-   Topic history and idea library
-   Wallet reservation and settlement
-   Retry handling and recovery
-   Job cancellation and notifications

### Phase 3 --- Improved production quality

Add:

-   More sophisticated visual identity controls
-   Better scene timing and transitions
-   Reusable intros and outros
-   Thumbnail generation
-   More rendering templates
-   More robust source tracking and factual verification
-   Better asset editing and regeneration controls

### Phase 4 --- Expanded media capabilities

Potential future capabilities:

-   AI-generated video clips
-   Mixed image and video scenes
-   More advanced voice and sound design
-   Additional output resolutions
-   More rendering and style templates

### Phase 5 --- Publishing integrations

Potential future capabilities:

-   YouTube publishing
-   TikTok and other social publishing integrations
-   Platform-specific descriptions and formats
-   Publishing calendars
-   Publishing status and analytics

These are future possibilities, not MVP dependencies.

------------------------------------------------------------------------

## 18. MVP acceptance criteria

The MVP should not be considered ready merely because a video can be
generated once from a developer's test screen.

At minimum:

1.  A user can create and configure a channel.
2.  The channel can select enabled LLM, image and TTS models.
3.  A user can manually start a production job.
4.  The system can generate a topic and script consistent with the
    channel.
5.  The system can generate narration from the script.
6.  The system can create a structured storyboard.
7.  The system creates a persistent slot for each required image.
8.  Image slots can be generated concurrently and retried independently.
9.  The coordinator advances only when all required image slots are
    complete.
10. The renderer produces a playable MP4 in the selected aspect ratio.
11. The user can download the MP4.
12. The user can access the job's script and production assets.
13. Stage status and errors remain visible after a page refresh or
    worker restart.
14. Retrying a task does not duplicate completed upstream work.
15. Usage and actual costs are recorded against the job.
16. A failed job preserves completed assets and records incurred costs.

Scheduling and full automation can follow once the manual production
pipeline is dependable.

------------------------------------------------------------------------

## 19. Product decisions to keep explicit

The following decisions should remain visible during implementation
rather than being silently assumed:

-   Whether users can choose exact models or only approved model
    aliases.
-   Which video resolutions are available at launch.
-   Whether users can upload their own music, images, logos and
    intro/outro assets.
-   Whether script editing is included in the first release.
-   Whether approval is required at topic, script, storyboard or
    final-video stages.
-   How long generated assets are retained.
-   What happens when a channel's scheduled job is due but its previous
    job is still running.
-   Whether a channel may have more than one active production job.
-   How cost overruns are handled when actual provider charges exceed
    the reservation.
-   Which research sources and verification requirements apply to
    factual channels.

These choices should be settled before the corresponding features are
implemented.

------------------------------------------------------------------------

## 20. Guiding principle

**Content Studio should make repeatable content production feel like
configuring a channel, not operating a complicated chain of AI
services.**

The user defines the channel and the level of control. Meckury AI
coordinates the providers, production stages, assets, rendering and
billing behind the scenes.

The first milestone is not automatic publishing or AI-generated video.
It is a reliable system that can turn a channel configuration into a
well-produced, downloadable video---and do it again without losing work,
duplicating charges or requiring the user to manage every technical
step.
