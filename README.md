# Siyuan Kanban Plugin

A simple Kanban board plugin for SiYuan Note that helps you manage tasks visually. Supports multiple independent boards.

## Features

- **Multiple Boards**: Create, rename, and delete independent kanban boards
- **Dock Sidebar**: Manage all boards from a sidebar panel
- **Tab Integration**: Each board opens in its own SiYuan tab
- **Default Columns**: Four default columns - Todo, In Progress, Blocked, Done
- **Custom Columns**: Add, rename, and delete columns as needed
- **Task Management**: Create, edit, and delete tasks with title, description, deadline, and file attachments
- **Drag and Drop**: Move tasks between columns by dragging
- **Done State**: Tasks in the "Done" column are visually distinguished with strikethrough styling
- **Deadline Visualization**: Color-coded deadline badges (normal, soon, urgent, overdue)
- **Data Persistence**: All data is saved automatically
- **Theme Support**: Supports both light and dark themes

## Installation

1. Clone this repository to your SiYuan plugins directory:
   ```
   {workspace}/data/plugins/siyuan-plugin-kanban
   ```

2. Or download the release package and extract to the plugins directory

3. Enable the plugin in SiYuan Note

## Usage

### Board Management

- Click the **Kanban icon** in the top bar to open a dropdown menu listing all boards
- Select a board to open it in a new tab, or click **New Board** to create one
- Use the **dock sidebar** (left bottom panel) to browse, rename, or delete boards

### Working with a Board

1. Click "+ Add Task" in any column to create a new task
2. Click on a task card to edit it
3. Drag and drop tasks between columns
4. Use the column header buttons to edit or delete columns
5. Use "Add Column" to add new columns
6. Use "Reset Board" to restore default columns (clears all tasks in that board)

## Task Properties

- **Title**: Task title (required)
- **Description**: Task description (optional, supports multi-line text)
- **Deadline**: Due date (optional, color-coded display)
- **Attachments**: File attachments (optional, uploaded to `data/assets/` via drag-and-drop or file picker)
- **Created**: Auto-generated timestamp

## Data Storage

Each board is stored separately under `data/storage/petal/siyuan-plugin-kanban/`:

- `boards-index` - Index of all boards (names, IDs)
- `board-{id}` - Individual board data (columns and tasks)

Data from the old single-board format (`kanban`) is automatically migrated on first load.

## License

MIT
