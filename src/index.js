/**
 * Siyuan Kanban Plugin
 * 一个简单的看板插件
 */

// 导入样式
import "./index.css";

// 导入 Plugin 类和 openTab - 由 Siyuan 应用在运行时通过全局 siyuan 对象提供
import { Plugin, openTab } from "siyuan";

const STORAGE_NAME = "kanban";
const TAB_TYPE = "kanban_tab";

class KanbanPlugin extends Plugin {
    // 不要自定义 constructor —— SiYuan 的 Plugin 基类需要接收 options 参数
    // 所有初始化工作放在 onload() 中

    async onload() {
        this.kanbanData = null;
        this.defaultColumns = [
            { id: 'todo', title: '待办', tasks: [] },
            { id: 'in-progress', title: '进行中', tasks: [] },
            { id: 'blocked', title: '阻塞', tasks: [] },
            { id: 'done', title: '已完成', tasks: [] }
        ];

        await this.loadKanbanData();

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
                const panelElement = plugin.createKanbanPanel();
                this.element.appendChild(panelElement);
                plugin.bindDragEvents(panelElement);
            },
            destroy() {
                console.log("Kanban tab destroyed");
            }
        });

        this.addCommand({
            langKey: "openKanban",
            hotkey: '⌘⇧K',
            callback: () => this.openKanban()
        });

        console.log('Kanban plugin loaded');
    }

    onLayoutReady() {
        // 在布局准备好后添加顶栏按钮
        this.addMenuItem();
    }

    async loadKanbanData() {
        try {
            const data = await this.loadData(STORAGE_NAME);
            if (data && data.columns) {
                this.kanbanData = data;
            } else {
                this.kanbanData = { columns: JSON.parse(JSON.stringify(this.defaultColumns)) };
                await this.saveKanbanData();
            }
        } catch (e) {
            console.error('Failed to load kanban data:', e);
            this.kanbanData = { columns: JSON.parse(JSON.stringify(this.defaultColumns)) };
            await this.saveKanbanData();
        }
    }

    async saveKanbanData() {
        try {
            await this.saveData(STORAGE_NAME, this.kanbanData);
        } catch (e) {
            console.error('Failed to save kanban data:', e);
        }
    }

    addMenuItem() {
        try {
            this.addTopBar({
                icon: "iconKanban",
                title: this.i18n.kanban,
                position: "right",
                callback: () => {
                    this.openKanban();
                }
            });
        } catch (e) {
            console.error('Error adding topBar:', e);
        }
    }

    openKanban() {
        openTab({
            app: this.app,
            custom: {
                icon: "iconKanban",
                title: this.i18n.kanban,
                data: {},
                id: this.name + TAB_TYPE
            },
        });
    }

    createKanbanPanel() {
        const panel = document.createElement('div');
        panel.className = 'kanban-panel';
        panel.innerHTML = `
            <div class="kanban-header">
                <div class="kanban-title">${this.i18n.kanban}</div>
                <div class="kanban-actions">
                    <button class="kanban-btn" id="add-column-btn">${this.i18n.addColumn}</button>
                    <button class="kanban-btn" id="reset-board-btn">${this.i18n.resetBoard}</button>
                </div>
            </div>
            <div class="kanban-board" id="kanban-board">
                ${this.renderColumns()}
            </div>
        `;

        panel.querySelector('#add-column-btn').addEventListener('click', () => {
            this.addColumn();
        });

        panel.querySelector('#reset-board-btn').addEventListener('click', () => {
            this.resetBoard();
        });

        // 绑定列内的事件
        this.bindColumnEvents(panel);

        return panel;
    }

    renderColumns() {
        return this.kanbanData.columns.map(column => `
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
                    ${column.tasks.map(task => this.renderTask(task)).join('')}
                </div>
                <button class="add-task-btn" data-column-id="${column.id}">+ ${this.i18n.addTask}</button>
            </div>
        `).join('');
    }

    renderTask(task) {
        const deadlineClass = this.getDeadlineClass(task.deadline);
        const deadlineText = task.deadline ? this.formatDate(task.deadline) : '';

        return `
            <div class="kanban-task" data-task-id="${task.id}" draggable="true">
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

    bindColumnEvents(panel) {
        // 添加任务按钮
        panel.querySelectorAll('.add-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const columnId = e.target.dataset.columnId;
                this.showTaskDialog(columnId);
            });
        });

        // 编辑列按钮
        panel.querySelectorAll('.edit-column-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const column = e.target.closest('.kanban-column');
                const columnId = column.dataset.columnId;
                this.editColumn(columnId);
            });
        });

        // 删除列按钮
        panel.querySelectorAll('.delete-column-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const column = e.target.closest('.kanban-column');
                const columnId = column.dataset.columnId;
                this.deleteColumn(columnId);
            });
        });

        // 编辑任务按钮
        panel.querySelectorAll('.edit-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const task = e.target.closest('.kanban-task');
                const taskId = task.dataset.taskId;
                this.editTask(taskId);
            });
        });

        // 删除任务按钮
        panel.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const task = e.target.closest('.kanban-task');
                const taskId = task.dataset.taskId;
                this.deleteTask(taskId);
            });
        });
    }

    bindDragEvents(panel) {
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
                this.moveTask(taskId, targetColumnId);
            });
        });
    }

    moveTask(taskId, targetColumnId) {
        let task = null;
        let sourceColumnId = null;

        // 找到任务并从原列中移除
        for (const column of this.kanbanData.columns) {
            const taskIndex = column.tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                task = column.tasks.splice(taskIndex, 1)[0];
                sourceColumnId = column.id;
                break;
            }
        }

        if (!task) return;

        // 将任务添加到目标列
        for (const column of this.kanbanData.columns) {
            if (column.id === targetColumnId) {
                column.tasks.push(task);
                break;
            }
        }

        // 保存并刷新
        this.saveKanbanData().then(() => this.refreshBoard());
    }

    refreshBoard() {
        const panel = document.querySelector('.kanban-panel');
        if (panel) {
            const board = panel.querySelector('#kanban-board');
            board.innerHTML = this.renderColumns();
            this.bindColumnEvents(panel);
            this.bindDragEvents(panel);
        }
    }

    showTaskDialog(columnId, task = null) {
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
                            ${this.kanbanData.columns.map(col => `
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

        // 绑定事件
        dialog.querySelector('.dialog-close-btn').addEventListener('click', () => dialog.remove());
        dialog.querySelector('.cancel-btn').addEventListener('click', () => dialog.remove());
        dialog.querySelector('.confirm-btn').addEventListener('click', () => {
            const title = dialog.querySelector('#task-title').value.trim();
            const description = dialog.querySelector('#task-description').value.trim();
            const deadline = dialog.querySelector('#task-deadline').value ? new Date(dialog.querySelector('#task-deadline').value).getTime() : null;

            if (!title) {
                alert(this.i18n.pleaseEnterTitle);
                return;
            }

            if (isEdit) {
                this.updateTask(task.id, title, description, deadline);
                const newColumnId = dialog.querySelector('#task-column').value;
                if (newColumnId !== columnId) {
                    this.moveTaskToColumn(task.id, newColumnId);
                }
            } else {
                this.addTask(columnId, title, description, deadline);
            }

            dialog.remove();
        });

        // 点击遮罩关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.remove();
        });
    }

    addTask(columnId, title, description, deadline) {
        const newTask = {
            id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            title,
            description,
            createdAt: Date.now(),
            deadline
        };

        for (const column of this.kanbanData.columns) {
            if (column.id === columnId) {
                column.tasks.push(newTask);
                break;
            }
        }

        this.saveKanbanData().then(() => this.refreshBoard());
    }

    updateTask(taskId, title, description, deadline) {
        for (const column of this.kanbanData.columns) {
            const task = column.tasks.find(t => t.id === taskId);
            if (task) {
                task.title = title;
                task.description = description;
                task.deadline = deadline;
                break;
            }
        }

        this.saveKanbanData().then(() => this.refreshBoard());
    }

    moveTaskToColumn(taskId, targetColumnId) {
        let task = null;
        let sourceColumnId = null;

        for (const column of this.kanbanData.columns) {
            const taskIndex = column.tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                task = column.tasks.splice(taskIndex, 1)[0];
                sourceColumnId = column.id;
                break;
            }
        }

        if (!task) return;

        for (const column of this.kanbanData.columns) {
            if (column.id === targetColumnId) {
                column.tasks.push(task);
                break;
            }
        }

        this.saveKanbanData().then(() => this.refreshBoard());
    }

    editTask(taskId) {
        let task = null;
        let columnId = null;

        for (const column of this.kanbanData.columns) {
            const foundTask = column.tasks.find(t => t.id === taskId);
            if (foundTask) {
                task = foundTask;
                columnId = column.id;
                break;
            }
        }

        if (task) {
            this.showTaskDialog(columnId, task);
        }
    }

    deleteTask(taskId) {
        if (!confirm(this.i18n.confirmDeleteTask)) return;

        for (const column of this.kanbanData.columns) {
            const taskIndex = column.tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                column.tasks.splice(taskIndex, 1);
                break;
            }
        }

        this.saveKanbanData().then(() => this.refreshBoard());
    }

    addColumn() {
        const title = prompt(this.i18n.enterColumnName);
        if (!title || !title.trim()) return;

        const newColumn = {
            id: 'col-' + Date.now(),
            title: title.trim(),
            tasks: []
        };

        this.kanbanData.columns.push(newColumn);
        this.saveKanbanData().then(() => this.refreshBoard());
    }

    editColumn(columnId) {
        const column = this.kanbanData.columns.find(c => c.id === columnId);
        if (!column) return;

        const newTitle = prompt(this.i18n.enterColumnName, column.title);
        if (!newTitle || !newTitle.trim()) return;

        column.title = newTitle.trim();
        this.saveKanbanData().then(() => this.refreshBoard());
    }

    deleteColumn(columnId) {
        if (!confirm(this.i18n.confirmDeleteColumn)) return;

        const columnIndex = this.kanbanData.columns.findIndex(c => c.id === columnId);
        if (columnIndex !== -1) {
            this.kanbanData.columns.splice(columnIndex, 1);
            this.saveKanbanData().then(() => this.refreshBoard());
        }
    }

    resetBoard() {
        if (!confirm(this.i18n.confirmReset)) return;

        this.kanbanData = { columns: JSON.parse(JSON.stringify(this.defaultColumns)) };
        this.saveKanbanData().then(() => this.refreshBoard());
    }

    onunload() {
        console.log('Kanban plugin unloaded');
    }

}

// 导出插件类，让思源笔记在运行时实例化
export default KanbanPlugin;
