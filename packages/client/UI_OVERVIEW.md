# CommHub UI/UX Design Overview

## Design Philosophy

The CommHub frontend follows a **brutalist design approach** with these key principles:

- **Minimal & Modern**: Clean interfaces with no unnecessary elements
- **Greyscale Palette**: Black, white, and shades of grey (grey-950 to grey-50)
- **Sharp Corners**: 2-4px border radius for a geometric, brutalist aesthetic
- **Bold Borders**: 2px borders throughout for strong visual separation
- **Responsive Interactions**: Instant visual feedback with subtle transitions

## Color System

```
- black (#000000)
- grey-950 (#0a0a0a) - Darkest background
- grey-900 (#141414) - Main backgrounds
- grey-850 (#1a1a1a) - Secondary backgrounds
- grey-800 (#1f1f1f) - Borders & dividers
- grey-700 (#2a2a2a) - Inactive borders
- grey-600 (#3d3d3d) - Hover states
- grey-500 (#6b6b6b) - Secondary text
- grey-400 (#8f8f8f) - Tertiary text
- grey-300 (#b3b3b3) - Primary grey text
- grey-200 (#d1d1d1) - Light text
- grey-100 (#e8e8e8) - Very light text
- grey-50 (#f5f5f5) - Near white
- white (#ffffff) - Accents & active states
```

## Layout Structure

### 3-Column Layout

```
+-------------+------------------+------------------------+
| ServerList  | ChannelList      | ChatArea              |
| (80px)      | (240px)          | (flex-1)              |
+-------------+------------------+------------------------+
```

## Components Built

### 1. ServerList (`ServerList.tsx`)

**Location**: Left sidebar (80px wide)

**Features**:

- Square server icons (56x56px) with 2-letter initials
- Active state: white background with black text
- Inactive state: grey-900 background with white text
- Home/DM button at top (Hash icon)
- Add server button at bottom (Plus icon)
- All buttons have 2px borders
- Hover: border changes from grey-700 to white

**Interaction States**:

- Default: grey-900 background, grey-700 border
- Hover: grey-800 background, white border
- Active: white background, black text, white border

### 2. ChannelList (`ChannelList.tsx`)

**Location**: Second column (240px wide)

**Features**:

- **Server Header**:
  - 56px tall, bold server name
  - Settings icon (gear)
  - Dropdown menu with: Invite People, Server Settings, Leave Server
- **Channel Sections**:
  - Text Channels: Hash icon prefix
  - Voice Channels: Volume icon prefix
  - Create channel button (Plus icon)
- **User Footer**:
  - User avatar (32x32px white square with initial)
  - Username and email
  - Logout button

**Channel States**:

- Default: transparent background, no border
- Hover: grey-850 background, grey-700 border
- Active: white background, black text, white border

### 3. ChatArea (`ChatArea.tsx`)

**Location**: Main content area (flex-1)

**Features**:

- **Channel Header**:
  - 56px tall
  - Channel name with hash icon
  - Members button (Users icon)
- **Messages Area**:
  - User avatar (40x40px white squares)
  - Username and timestamp
  - Message content
  - Smart grouping: consecutive messages from same user show timestamp on hover
  - Auto-scroll to bottom on new messages
  - Empty state with welcome message

- **Message Input**:
  - Multi-line textarea
  - Send button (white bg, black text)
  - Keyboard shortcuts: Enter to send, Shift+Enter for new line
  - Character limit: 2000
  - Disabled state for empty messages

### 4. ServerModal (`ServerModal.tsx`)

**Modal for creating/joining servers**

**Modes**:

1. **Choose**: Initial screen with two options
   - Create Server (white button)
   - Join Server (grey button)

2. **Create Mode**:
   - Server name input (required)
   - Description textarea (optional)
   - Back & Create buttons

3. **Join Mode**:
   - Invite code input (monospace font)
   - Back & Join buttons

**Design**:

- Centered modal with backdrop (80% black overlay)
- White 2px border
- Slide-up animation
- Form validation with error states

### 5. ChannelModal (`ChannelModal.tsx`)

**Modal for creating channels**

**Features**:

- Channel type selector (Text/Voice) as toggle buttons
- Channel name input with icon prefix
- Auto-formatting: lowercase, no spaces (replaced with hyphens)
- Character limit: 30
- Active type: white background
- Inactive type: grey-850 background

### 6. Sidebar (`Sidebar.tsx`)

**Wrapper combining ServerList and ChannelList**

Simple flex container that holds both components side-by-side.

## Interaction Patterns

### Buttons

```css
/* Brutalist Button Style */
- 2px solid borders
- Instant color transitions (100ms)
- No rounded corners
- Clear hover states
- Disabled states with reduced opacity
```

### Inputs & Textareas

```css
- grey-850 background
- grey-700 border (2px)
- White text
- White border on focus
- Sharp corners (2px radius)
- Monospace font for code-like inputs
```

### Modals

```css
- Fixed position overlay
- 80% black backdrop
- Slide-up animation (0.3s)
- Fade-in backdrop (0.2s)
- White 2px border
- Centered vertically & horizontally
```

### Messages

```css
- Message-enter animation (slide-up)
- Hover effects on grouped messages
- Smart timestamp display
- Break-word wrapping for long text
```

## Animations

### Custom Animations

1. **fade-in**: 0.2s opacity transition
2. **slide-up**: 0.3s translate + opacity
3. **slide-down**: 0.3s translate + opacity
4. **message-enter**: 0.2s message appearance

## Typography

### Font Stack

```
Primary: Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto
Mono: JetBrains Mono, Consolas, Monaco
```

### Text Sizes

- Headings: 18-24px, font-bold
- Body: 14px, font-medium
- Small: 12px, font-normal
- Tiny: 10px (labels, hints)

## Scrollbars

Custom brutalist scrollbars:

- Width: 8px
- Track: grey-850
- Thumb: grey-600
- Thumb hover: grey-500
- Square corners (no border-radius)

## State Management Integration

All components are connected to Zustand stores:

- `useAuthStore`: User authentication
- `useServersStore`: Server management
- `useChannelsStore`: Channel management
- `useMessagesStore`: Real-time messaging

WebSocket integration via `wsManager` for real-time updates.

## Key Features Implemented

✅ Server creation and joining
✅ Channel creation (text & voice)
✅ Real-time messaging with WebSocket
✅ User presence indicators
✅ Invite code generation and sharing
✅ Server settings placeholder
✅ Responsive layout
✅ Keyboard shortcuts
✅ Smart message grouping
✅ Auto-scroll on new messages
✅ Loading states
✅ Error handling
✅ Form validation

## Accessibility

- Keyboard navigation supported
- ARIA labels on icon buttons (title attributes)
- Focus states on all interactive elements
- High contrast greyscale palette
- Clear visual hierarchy

## Future Enhancements

- Voice channel functionality
- User avatars from uploads
- Message reactions
- Mention system
- Rich text formatting (Markdown)
- Emoji picker
- User profiles
- Server roles & permissions
- Search functionality
- Notification system
