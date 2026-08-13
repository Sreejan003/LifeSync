const addButton = document.querySelector("#addi");
const taskInput = document.querySelector("#task_list");

const taskContainer = document.querySelector("#taskContainer");
const emptyState = document.querySelector("#emptyState");

const deleteAll = document.querySelector("#deleteAll");

const pendingCount = document.querySelector("#pendingCount");
const completedCount = document.querySelector("#completedCount");
const totalCount = document.querySelector("#totalCount");

const progressCircle = document.querySelector("#progressCircle");
const progressPercent = document.querySelector("#progressPercent");


// =========================
// LOAD TASKS
// =========================

let tasks = JSON.parse(localStorage.getItem("lifesyncTasks")) || [];


// =========================
// SAVE TASKS
// =========================

function saveTasks() {

    localStorage.setItem(
        "lifesyncTasks",
        JSON.stringify(tasks)
    );
}


// =========================
// ADD TASK
// =========================

function addTask() {

    const text = taskInput.value.trim();

    if (text === "") {

        alert("Please enter a task.");

        return;
    }


    const task = {

        id: Date.now(),

        text: text,

        completed: false

    };


    tasks.push(task);

    saveTasks();

    taskInput.value = "";

    renderTasks();
}


// =========================
// RENDER TASKS
// =========================

function renderTasks() {

    taskContainer.innerHTML = "";


    if (tasks.length === 0) {

        emptyState.style.display = "block";

    } else {

        emptyState.style.display = "none";
    }


    tasks.forEach(task => {

        const taskDiv = document.createElement("div");

        taskDiv.classList.add("task");


        if (task.completed) {

            taskDiv.classList.add("completed");
        }


        // Checkbox

        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";

        checkbox.classList.add("check");

        checkbox.checked = task.completed;


        // Task text

        const text = document.createElement("p");

        text.classList.add("text");

        text.innerText = task.text;


        // Delete button

        const deleteButton = document.createElement("button");

        deleteButton.classList.add("deleteop");

        deleteButton.innerHTML = "➖";


        // =========================
        // CHECKBOX EVENT
        // =========================

        checkbox.addEventListener("change", () => {

            task.completed = checkbox.checked;

            saveTasks();

            renderTasks();
        });


        // =========================
        // DELETE EVENT
        // =========================

        deleteButton.addEventListener("click", () => {

            tasks = tasks.filter(
                t => t.id !== task.id
            );

            saveTasks();

            renderTasks();
        });


        taskDiv.appendChild(checkbox);

        taskDiv.appendChild(text);

        taskDiv.appendChild(deleteButton);

        taskContainer.appendChild(taskDiv);

    });


    updateStats();
}


// =========================
// UPDATE STATISTICS
// =========================

function updateStats() {

    const total = tasks.length;


    const completed = tasks.filter(
        task => task.completed
    ).length;


    const pending = total - completed;


    totalCount.innerText = total;

    completedCount.innerText = completed;

    pendingCount.innerText = pending;


    // =========================
    // PROGRESS
    // =========================

    let percentage = 0;


    if (total > 0) {

        percentage = Math.round(
            (completed / total) * 100
        );
    }


    progressPercent.innerText =
        percentage + "%";


    const degree =
        percentage * 3.6;


    progressCircle.style.background =
        `conic-gradient(
            #6842d8 ${degree}deg,
            #e7e2f9 ${degree}deg
        )`;
}


// =========================
// ADD BUTTON
// =========================

addButton.addEventListener(
    "click",
    addTask
);


// =========================
// ENTER KEY
// =========================

taskInput.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {

            addTask();
        }
    }
);


// =========================
// DELETE ALL
// =========================

deleteAll.addEventListener(
    "click",
    () => {

        if (tasks.length === 0) {

            return;
        }


        const confirmDelete =
            confirm("Delete all your tasks?");


        if (!confirmDelete) {

            return;
        }


        tasks = [];

        saveTasks();

        renderTasks();
    }
);


// =========================
// INITIAL DISPLAY
// =========================

renderTasks();