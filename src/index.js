import "./index.css";
import { Plugin, openTab, Menu, getFrontend, adaptHotkey, confirm as siyuanConfirm, Dialog, showMessage } from "siyuan";

const STORAGE_BOARDS_INDEX = "boards-index";
const TAB_TYPE = "kanban_tab";
const DOCK_TYPE = "kanban_dock";

class KanbanPlugin extends Plugin {

    async onload() {
        this.boards = new Map();
        this.boardIndex = { boards: [] };
        this.isMobile = ["mobile", "browser-mobile"].includes(getFrontend());
        this.defaultColumns = [
            { id: 'todo', title: '待办', tasks: [] },
            { id: 'in-progress', title: '进行中', tasks: [] },
            { id: 'blocked', title: '阻塞', tasks: [] },
            { id: 'done', title: '已完成', tasks: [] }
        ];

        await this.migrateAndLoadIndex();

        try {
            this.addIcons(`<symbol id="iconKanban" viewBox="0 0 32 32">
                <rect x="2" y="4" width="28" height="24" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
                <line x1="10" y1="4" x2="10" y2="28" stroke="currentColor" stroke-width="2"/>
                <line x1="22" y1="4" x2="22" y2="28" stroke="currentColor" stroke-width="2"/>
            </symbol>`);
        } catch (e) {
            console.error('Error registering icon:', e);
        }

        const plugin = this;
        this.customTab = this.addTab({
            type: TAB_TYPE,
            init() {
                const boardId = this.data && this.data.boardId;
                if (!boardId) return;
                const tabElement = this.element;
                const mount = () => {
                    const panelElement = plugin.createKanbanPanel(boardId);
                    tabElement.appendChild(panelElement);
                    plugin.bindDragEvents(panelElement);
                };
                if (plugin.boards.has(boardId)) {
                    mount();
                } else {
                    plugin.loadBoardData(boardId).then(mount).catch(e => {
                        console.error('Failed to load board:', e);
                    });
                }
            },
            destroy() {
            }
        });

        this.addDock({
            config: {
                position: "LeftBottom",
                size: { width: 220, height: 0 },
                icon: "iconKanban",
                title: this.i18n.kanban,
                hotkey: "",
            },
            data: {},
            type: DOCK_TYPE,
            init: (dock) => {
                this.dockElement = dock.element;
                this.renderDock();
            },
            destroy: () => {
                this.dockElement = null;
            }
        });

        console.log('Kanban plugin loaded');
    }

    onLayoutReady() {
        this.addMenuItem();
    }

    showPromptDialog(title, defaultValue, callback) {
        const id = 'kanban-prompt-' + Date.now();
        const dialog = new Dialog({
            title,
            content: `<div class="b3-dialog__content">
                <input class="b3-text-field fn__block" id="${id}" value="${this.escapeHtml(defaultValue || '')}">
            </div>
            <div class="b3-dialog__action">
                <button class="b3-button b3-button--cancel">${this.i18n.cancel}</button>
                <div class="fn__space"></div>
                <button class="b3-button b3-button--text">${this.i18n.confirm}</button>
            </div>`,
            width: this.isMobile ? "92vw" : "400px",
        });
        const inputEl = dialog.element.querySelector(`#${id}`);
        const btns = dialog.element.querySelectorAll('.b3-button');
        dialog.bindInput(inputEl, () => btns[1].click());
        inputEl.focus();
        inputEl.select();
        btns[0].addEventListener('click', () => dialog.destroy());
        btns[1].addEventListener('click', () => {
            const val = inputEl.value.trim();
            dialog.destroy();
            if (val) callback(val);
        });
    }

    // =========== Data Layer ===========

    async migrateAndLoadIndex() {
        try {
            const index = await this.loadData(STORAGE_BOARDS_INDEX);
            if (index && index.boards && index.boards.length > 0) {
                this.boardIndex = index;
                return;
            }
        } catch (e) { /* no index yet */ }

        try {
            const oldData = await this.loadData("kanban");
            if (oldData && oldData.columns) {
                const boardId = 'board-' + Date.now();
                this.boardIndex = {
                    boards: [{ id: boardId, name: this.i18n.defaultBoardName, createdAt: Date.now() }]
                };
                this.boards.set(boardId, oldData);
                await this.saveData(boardId, oldData);
                await this.saveData(STORAGE_BOARDS_INDEX, this.boardIndex);
                return;
            }
        } catch (e) { /* no old data */ }

        const boardId = 'board-' + Date.now();
        const defaultData = { columns: JSON.parse(JSON.stringify(this.defaultColumns)) };
        this.boardIndex = {
            boards: [{ id: boardId, name: this.i18n.defaultBoardName, createdAt: Date.now() }]
        };
        this.boards.set(boardId, defaultData);
        await this.saveData(boardId, defaultData);
        await this.saveData(STORAGE_BOARDS_INDEX, this.boardIndex);
    }

    async saveBoardIndex() {
        await this.saveData(STORAGE_BOARDS_INDEX, this.boardIndex);
    }

    async loadBoardData(boardId) {
        if (this.boards.has(boardId)) return this.boards.get(boardId);
        try {
            const data = await this.loadData(boardId);
            if (data && data.columns) {
                this.boards.set(boardId, data);
                return data;
            }
        } catch (e) { /* fall through */ }
        const defaultData = { columns: JSON.parse(JSON.stringify(this.defaultColumns)) };
        this.boards.set(boardId, defaultData);
        await this.saveData(boardId, defaultData);
        return defaultData;
    }

    async saveBoardData(boardId) {
        const data = this.boards.get(boardId);
        if (data) {
            await this.saveData(boardId, data);
        }
    }

    getBoardData(boardId) {
        return this.boards.get(boardId);
    }

    // =========== Board CRUD ===========

    async createBoard(name) {
        const boardId = 'board-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        const boardData = { columns: JSON.parse(JSON.stringify(this.defaultColumns)) };
        this.boards.set(boardId, boardData);
        this.boardIndex.boards.push({ id: boardId, name, createdAt: Date.now() });
        await this.saveData(boardId, boardData);
        await this.saveBoardIndex();
        this.refreshDock();
        return boardId;
    }

    async renameBoard(boardId, newName) {
        const board = this.boardIndex.boards.find(b => b.id === boardId);
        if (board) {
            board.name = newName;
            await this.saveBoardIndex();
            this.refreshDock();
        }
    }

    async deleteBoard(boardId) {
        const idx = this.boardIndex.boards.findIndex(b => b.id === boardId);
        if (idx === -1) return;
        this.boardIndex.boards.splice(idx, 1);
        this.boards.delete(boardId);
        try { await this.removeData(boardId); } catch (e) { /* ignore */ }
        await this.saveBoardIndex();
        this.refreshDock();
    }

    // =========== Top Bar Menu ===========

    addMenuItem() {
        try {
            const topBarElement = this.addTopBar({
                icon: "iconKanban",
                title: this.i18n.kanban,
                position: "right",
                callback: () => {
                    if (this.isMobile) {
                        this.showBoardMenu();
                    } else {
                        let rect = topBarElement.getBoundingClientRect();
                        if (rect.width === 0) {
                            rect = document.querySelector("#barMore").getBoundingClientRect();
                        }
                        this.showBoardMenu(rect);
                    }
                }
            });
        } catch (e) {
            console.error('Error adding topBar:', e);
        }
    }

    showBoardMenu(rect) {
        const menu = new Menu("kanbanBoardMenu");

        this.boardIndex.boards.forEach(board => {
            menu.addItem({
                icon: "iconKanban",
                label: board.name,
                click: () => this.openBoard(board.id)
            });
        });

        menu.addSeparator();

        menu.addItem({
            icon: "iconAdd",
            label: this.i18n.newBoard,
            click: () => {
                this.showPromptDialog(this.i18n.newBoard, '', (name) => {
                    this.createBoard(name).then(boardId => {
                        this.openBoard(boardId);
                    });
                });
            }
        });

        if (this.isMobile) {
            menu.fullscreen();
        } else if (rect) {
            menu.open({ x: rect.right, y: rect.bottom, isLeft: true });
        }
    }

    // =========== Tab ===========

    openBoard(boardId) {
        const board = this.boardIndex.boards.find(b => b.id === boardId);
        if (!board) return;
        openTab({
            app: this.app,
            custom: {
                icon: "iconKanban",
                title: board.name,
                data: { boardId },
                id: this.name + TAB_TYPE
            },
        });
    }

    // =========== Dock Sidebar ===========

    renderDock() {
        if (!this.dockElement) return;

        if (this.isMobile) {
            this.dockElement.innerHTML = `
                <div class="toolbar toolbar--border toolbar--dark">
                    <svg class="toolbar__icon"><use xlink:href="#iconKanban"></use></svg>
                    <div class="toolbar__text">${this.i18n.kanban}</div>
                </div>
                <div class="fn__flex-1 kanban-dock-list">
                    ${this.renderDockBoardList()}
                </div>`;
        } else {
            this.dockElement.innerHTML = `
                <div class="fn__flex-1 fn__flex-column">
                    <div class="block__icons">
                        <div class="block__logo">
                            <svg class="block__logoicon"><use xlink:href="#iconKanban"></use></svg>
                            ${this.i18n.kanban}
                        </div>
                        <span class="fn__flex-1 fn__space"></span>
                        <span class="block__icon kanban-dock-add b3-tooltips b3-tooltips__sw" aria-label="${this.i18n.newBoard}">
                            <svg><use xlink:href="#iconAdd"></use></svg>
                        </span>
                        <span data-type="min" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="Min ${adaptHotkey("⌘W")}">
                            <svg><use xlink:href="#iconMin"></use></svg>
                        </span>
                    </div>
                    <div class="fn__flex-1 kanban-dock-list">
                        ${this.renderDockBoardList()}
                    </div>
                </div>`;
        }

        this.bindDockEvents();
    }

    renderDockBoardList() {
        if (this.boardIndex.boards.length === 0) {
            return `<div class="kanban-dock-empty">${this.i18n.newBoard}...</div>`;
        }
        return this.boardIndex.boards.map(board => `
            <div class="kanban-dock-item" data-board-id="${board.id}">
                <svg class="kanban-dock-item-icon"><use xlink:href="#iconKanban"></use></svg>
                <span class="kanban-dock-item-name">${this.escapeHtml(board.name)}</span>
                <div class="kanban-dock-item-actions">
                    <span class="kanban-dock-item-btn kanban-dock-rename" title="${this.i18n.renameBoard}">✎</span>
                    <span class="kanban-dock-item-btn kanban-dock-delete" title="${this.i18n.deleteBoard}">×</span>
                </div>
            </div>
        `).join('');
    }

    bindDockEvents() {
        if (!this.dockElement) return;

        this.dockElement.querySelector('.kanban-dock-add')?.addEventListener('click', () => {
            this.showPromptDialog(this.i18n.newBoard, '', (name) => {
                this.createBoard(name).then(boardId => {
                    this.openBoard(boardId);
                });
            });
        });

        this.dockElement.querySelectorAll('.kanban-dock-item').forEach(item => {
            const boardId = item.dataset.boardId;
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.kanban-dock-item-actions')) {
                    this.openBoard(boardId);
                }
            });
        });

        this.dockElement.querySelectorAll('.kanban-dock-rename').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const boardId = e.target.closest('.kanban-dock-item').dataset.boardId;
                const board = this.boardIndex.boards.find(b => b.id === boardId);
                if (board) {
                    this.showPromptDialog(this.i18n.renameBoard, board.name, (newName) => {
                        this.renameBoard(boardId, newName);
                    });
                }
            });
        });

        this.dockElement.querySelectorAll('.kanban-dock-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const boardId = e.target.closest('.kanban-dock-item').dataset.boardId;
                siyuanConfirm("⚠️", this.i18n.confirmDeleteBoard, () => {
                    this.deleteBoard(boardId);
                });
            });
        });
    }

    refreshDock() {
        this.renderDock();
    }

    // =========== Kanban Panel ===========

    createKanbanPanel(boardId) {
        const boardInfo = this.boardIndex.boards.find(b => b.id === boardId);
        const panel = document.createElement('div');
        panel.className = 'kanban-panel';
        panel.dataset.boardId = boardId;
        panel.innerHTML = `
            <div class="kanban-header">
                <div class="kanban-title">${this.escapeHtml(boardInfo ? boardInfo.name : this.i18n.kanban)}</div>
                <div class="kanban-actions">
                    <button class="kanban-btn add-column-btn">${this.i18n.addColumn}</button>
                    <button class="kanban-btn reset-board-btn">${this.i18n.resetBoard}</button>
                </div>
            </div>
            <div class="kanban-board">
                ${this.renderColumns(boardId)}
            </div>
        `;

        panel.querySelector('.add-column-btn').addEventListener('click', () => {
            this.addColumn(boardId);
        });

        panel.querySelector('.reset-board-btn').addEventListener('click', () => {
            this.resetBoard(boardId);
        });

        this.bindColumnEvents(panel, boardId);

        return panel;
    }

    renderColumns(boardId) {
        const boardData = this.getBoardData(boardId);
        if (!boardData) return '';
        return boardData.columns.map(column => `
            <div class="kanban-column" data-column-id="${column.id}">
                <div class="column-header">
                    <span class="column-title">${column.title}</span>
                    <span class="column-count">${column.tasks.length}</span>
                    <div class="column-actions">
                        <button class="column-action-btn edit-column-btn" title="${this.i18n.editColumn}">✎</button>
                        <button class="column-action-btn delete-column-btn" title="${this.i18n.deleteColumn}">×</button>
                    </div>
                </div>
                <div class="column-tasks" data-column-id="${column.id}">
                    ${column.tasks.map(task => this.renderTask(task, column.id)).join('')}
                </div>
                <button class="add-task-btn" data-column-id="${column.id}">+ ${this.i18n.addTask}</button>
            </div>
        `).join('');
    }

    renderTask(task, columnId) {
        const deadlineClass = this.getDeadlineClass(task.deadline);
        const deadlineText = task.deadline ? this.formatDate(task.deadline) : '';
        const doneClass = columnId === 'done' ? ' task-done' : '';

        return `
            <div class="kanban-task${doneClass}" data-task-id="${task.id}" draggable="true">
                <div class="task-title">${this.escapeHtml(task.title)}</div>
                ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
                <div class="task-meta">
                    ${deadlineText ? `<span class="task-deadline ${deadlineClass}">${deadlineText}</span>` : ''}
                    <span class="task-created">${this.formatDate(task.createdAt)}</span>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn edit-task-btn" title="${this.i18n.editTask}">✎</button>
                    <button class="task-action-btn delete-task-btn" title="${this.i18n.deleteTask}">×</button>
                </div>
            </div>
        `;
    }

    getDeadlineClass(deadline) {
        if (!deadline) return '';
        const now = Date.now();
        const diff = deadline - now;
        const days = diff / (1000 * 60 * 60 * 24);

        if (diff < 0) return 'deadline-overdue';
        if (days < 3) return 'deadline-urgent';
        if (days < 7) return 'deadline-soon';
        return 'deadline-normal';
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // =========== Board Event Binding ===========

    bindColumnEvents(panel, boardId) {
        panel.querySelectorAll('.add-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const columnId = e.target.dataset.columnId;
                this.showTaskDialog(columnId, null, boardId);
            });
        });

        panel.querySelectorAll('.edit-column-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const column = e.target.closest('.kanban-column');
                const columnId = column.dataset.columnId;
                this.editColumn(columnId, boardId);
            });
        });

        panel.querySelectorAll('.delete-column-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const column = e.target.closest('.kanban-column');
                const columnId = column.dataset.columnId;
                this.deleteColumn(columnId, boardId);
            });
        });

        panel.querySelectorAll('.edit-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const task = e.target.closest('.kanban-task');
                const taskId = task.dataset.taskId;
                this.editTask(taskId, boardId);
            });
        });

        panel.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const task = e.target.closest('.kanban-task');
                const taskId = task.dataset.taskId;
                this.deleteTask(taskId, boardId);
            });
        });
    }

    bindDragEvents(panel) {
        const boardId = panel.dataset.boardId;
        const tasks = panel.querySelectorAll('.kanban-task');
        const columns = panel.querySelectorAll('.column-tasks');

        tasks.forEach(task => {
            task.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', task.dataset.taskId);
                task.classList.add('dragging');
            });

            task.addEventListener('dragend', () => {
                task.classList.remove('dragging');
            });
        });

        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
            });

            column.addEventListener('dragleave', () => {
                column.classList.remove('drag-over');
            });

            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');
                const taskId = e.dataTransfer.getData('text/plain');
                const targetColumnId = column.dataset.columnId;
                this.moveTask(taskId, targetColumnId, boardId);
            });
        });
    }

    // =========== Board Operations ===========

    refreshBoard(boardId) {
        const panel = document.querySelector(`.kanban-panel[data-board-id="${boardId}"]`);
        if (panel) {
            const board = panel.querySelector('.kanban-board');
            board.innerHTML = this.renderColumns(boardId);
            this.bindColumnEvents(panel, boardId);
            this.bindDragEvents(panel);
        }
    }

    moveTask(taskId, targetColumnId, boardId) {
        const boardData = this.getBoardData(boardId);
        if (!boardData) return;
        let task = null;

        for (const column of boardData.columns) {
            const taskIndex = column.tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                task = column.tasks.splice(taskIndex, 1)[0];
                break;
            }
        }

        if (!task) return;

        for (const column of boardData.columns) {
            if (column.id === targetColumnId) {
                column.tasks.push(task);
                break;
            }
        }

        this.saveBoardData(boardId).then(() => this.refreshBoard(boardId));
    }

    showTaskDialog(columnId, task, boardId) {
        const boardData = this.getBoardData(boardId);
        if (!boardData) return;
        const isEdit = !!task;
        const dialog = document.createElement('div');
        dialog.className = 'kanban-dialog-overlay';
        dialog.innerHTML = `
            <div class="kanban-dialog">
                <div class="dialog-header">
                    <h3>${isEdit ? this.i18n.editTask : this.i18n.addTask}</h3>
                    <button class="dialog-close-btn">×</button>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <label>${this.i18n.taskTitle}</label>
                        <input type="text" id="task-title" value="${task ? this.escapeHtml(task.title) : ''}" placeholder="${this.i18n.taskTitlePlaceholder}">
                    </div>
                    <div class="form-group">
                        <label>${this.i18n.taskDescription}</label>
                        <textarea id="task-description" placeholder="${this.i18n.taskDescriptionPlaceholder}">${task ? this.escapeHtml(task.description) : ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>${this.i18n.deadline}</label>
                        <input type="date" id="task-deadline" value="${task && task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : ''}">
                    </div>
                    ${isEdit ? `
                    <div class="form-group">
                        <label>${this.i18n.column}</label>
                        <select id="task-column">
                            ${boardData.columns.map(col => `
                                <option value="${col.id}" ${col.id === columnId ? 'selected' : ''}>${col.title}</option>
                            `).join('')}
                        </select>
                    </div>
                    ` : ''}
                </div>
                <div class="dialog-footer">
                    <button class="kanban-btn cancel-btn">${this.i18n.cancel}</button>
                    <button class="kanban-btn confirm-btn">${this.i18n.confirm}</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        dialog.querySelector('.dialog-close-btn').addEventListener('click', () => dialog.remove());
        dialog.querySelector('.cancel-btn').addEventListener('click', () => dialog.remove());
        dialog.querySelector('.confirm-btn').addEventListener('click', () => {
            const title = dialog.querySelector('#task-title').value.trim();
            const description = dialog.querySelector('#task-description').value.trim();
            const deadline = dialog.querySelector('#task-deadline').value ? new Date(dialog.querySelector('#task-deadline').value).getTime() : null;

            if (!title) {
                showMessage(this.i18n.pleaseEnterTitle);
                return;
            }

            if (isEdit) {
                this.updateTask(task.id, title, description, deadline, boardId);
                const newColumnId = dialog.querySelector('#task-column').value;
                if (newColumnId !== columnId) {
                    this.moveTaskToColumn(task.id, newColumnId, boardId);
                }
            } else {
                this.addTask(columnId, title, description, deadline, boardId);
            }

            dialog.remove();
        });

        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.remove();
        });
    }

    addTask(columnId, title, description, deadline, boardId) {
        const boardData = this.getBoardData(boardId);
        if (!boardData) return;
        const newTask = {
            id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            title,
            description,
            createdAt: Date.now(),
            deadline
        };

        for (const column of boardData.columns) {
            if (column.id === columnId) {
                column.tasks.push(newTask);
                break;
            }
        }

        this.saveBoardData(boardId).then(() => this.refreshBoard(boardId));
    }

    updateTask(taskId, title, description, deadline, boardId) {
        const boardData = this.getBoardData(boardId);
        if (!boardData) return;

        for (const column of boardData.columns) {
            const task = column.tasks.find(t => t.id === taskId);
            if (task) {
                task.title = title;
                task.description = description;
                task.deadline = deadline;
                break;
            }
        }

        this.saveBoardData(boardId).then(() => this.refreshBoard(boardId));
    }

    moveTaskToColumn(taskId, targetColumnId, boardId) {
        const boardData = this.getBoardData(boardId);
        if (!boardData) return;
        let task = null;

        for (const column of boardData.columns) {
            const taskIndex = column.tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                task = column.tasks.splice(taskIndex, 1)[0];
                break;
            }
        }

        if (!task) return;

        for (const column of boardData.columns) {
            if (column.id === targetColumnId) {
                column.tasks.push(task);
                break;
            }
        }

        this.saveBoardData(boardId).then(() => this.refreshBoard(boardId));
    }

    editTask(taskId, boardId) {
        const boardData = this.getBoardData(boardId);
        if (!boardData) return;
        let task = null;
        let columnId = null;

        for (const column of boardData.columns) {
            const foundTask = column.tasks.find(t => t.id === taskId);
            if (foundTask) {
                task = foundTask;
                columnId = column.id;
                break;
            }
        }

        if (task) {
            this.showTaskDialog(columnId, task, boardId);
        }
    }

    deleteTask(taskId, boardId) {
        siyuanConfirm("⚠️", this.i18n.confirmDeleteTask, () => {
            const boardData = this.getBoardData(boardId);
            if (!boardData) return;

            for (const column of boardData.columns) {
                const taskIndex = column.tasks.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                    column.tasks.splice(taskIndex, 1);
                    break;
                }
            }

            this.saveBoardData(boardId).then(() => this.refreshBoard(boardId));
        });
    }

    addColumn(boardId) {
        this.showPromptDialog(this.i18n.addColumn, '', (title) => {
            const boardData = this.getBoardData(boardId);
            if (!boardData) return;

            boardData.columns.push({
                id: 'col-' + Date.now(),
                title,
                tasks: []
            });

            this.saveBoardData(boardId).then(() => this.refreshBoard(boardId));
        });
    }

    editColumn(columnId, boardId) {
        const boardData = this.getBoardData(boardId);
        if (!boardData) return;
        const column = boardData.columns.find(c => c.id === columnId);
        if (!column) return;

        this.showPromptDialog(this.i18n.editColumn, column.title, (newTitle) => {
            column.title = newTitle;
            this.saveBoardData(boardId).then(() => this.refreshBoard(boardId));
        });
    }

    deleteColumn(columnId, boardId) {
        siyuanConfirm("⚠️", this.i18n.confirmDeleteColumn, () => {
            const boardData = this.getBoardData(boardId);
            if (!boardData) return;

            const columnIndex = boardData.columns.findIndex(c => c.id === columnId);
            if (columnIndex !== -1) {
                boardData.columns.splice(columnIndex, 1);
                this.saveBoardData(boardId).then(() => this.refreshBoard(boardId));
            }
        });
    }

    resetBoard(boardId) {
        siyuanConfirm("⚠️", this.i18n.confirmReset, () => {
            const defaultData = { columns: JSON.parse(JSON.stringify(this.defaultColumns)) };
            this.boards.set(boardId, defaultData);
            this.saveBoardData(boardId).then(() => this.refreshBoard(boardId));
        });
    }

    onunload() {
        console.log('Kanban plugin unloaded');
    }
}

export default KanbanPlugin;
