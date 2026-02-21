# Siyuan Kanban Plugin

A simple Kanban board plugin for Siyuan Note that helps you manage tasks visually.

## Features

- **Default Columns**: Four default columns - Todo, In Progress, Done, Blocked
- **Custom Columns**: Add, rename, and delete columns as needed
- **Task Management**: Create, edit, and delete tasks with title, description, deadline
- **Drag and Drop**: Easily move tasks between columns
- **Deadline Visualization**: Color-coded deadline badges (normal, soon, urgent, overdue)
- **Data Persistence**: All data is saved automatically
- **Theme Support**: Supports both light and dark themes

## Installation

1. Clone this repository to your Siyuan plugins directory:
   ```
   {workspace}/data/plugins/siyuan-plugin-kanban
   ```

2. Or download the release package and extract to the plugins directory

3. Enable the plugin in Siyuan Note

## Usage

1. Click the Kanban icon in the top bar to open the board
2. Click "+ Add Task" in any column to create a new task
3. Click on a task card to edit it
4. Drag and drop tasks between columns
5. Use the column header buttons to edit or delete columns
6. Use "Add Column" to add new columns
7. Use "Reset Board" to restore default columns (will clear all data)

## Task Properties

- **Title**: Task title (required)
- **Description**: Task description (optional, supports multi-line text)
- **Deadline**: Due date (optional, color-coded display)
- **Created**: Auto-generated timestamp

## Keyboard Shortcuts

- `⌘⇧K` (Mac) / `Ctrl⇧K` (Windows): Open Kanban board

## Data Storage

Data is stored in `data/plugins/siyuan-plugin-kanban/kanban.json`

## License

MIT
