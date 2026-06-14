package com.taskflow.android.ui.tasks

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.taskflow.android.data.model.Task
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(viewModel: TasksViewModel) {
    val state by viewModel.today.collectAsStateWithLifecycle()
    var showAdd by remember { mutableStateOf(false) }
    var editTask by remember { mutableStateOf<Task?>(null) }

    val today = LocalDate.now()
    val title = "${today.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.getDefault())}, " +
            "${today.month.getDisplayName(TextStyle.SHORT, Locale.getDefault())} ${today.dayOfMonth}"

    LaunchedEffect(Unit) { viewModel.loadToday() }

    Scaffold(
        topBar = { TopAppBar(title = { Text(title) }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAdd = true }) {
                Icon(Icons.Default.Add, contentDescription = "Add task")
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.isLoading -> CircularProgressIndicator(Modifier.align(Alignment.Center))
                state.error != null -> Text(
                    state.error!!,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.align(Alignment.Center).padding(16.dp),
                )
                state.tasks.isEmpty() -> Text(
                    "Nothing scheduled for today",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.align(Alignment.Center),
                )
                else -> LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(state.tasks, key = { it.id }) { task ->
                        TaskCard(
                            task = task,
                            onComplete = { viewModel.completeTask(task) },
                            onClick = { editTask = task },
                        )
                    }
                }
            }
        }
    }

    if (showAdd) {
        val todayDate = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
        AddEditTaskSheet(
            onDismiss = { showAdd = false },
            onSave = { title2, description, priority, status ->
                val date = if (status == "SCHEDULED") todayDate else null
                viewModel.createTask(title2, description, priority, "SCHEDULED", date)
            },
        )
    }

    editTask?.let { task ->
        TaskDetailSheet(
            task = task,
            onDismiss = { editTask = null },
            onComplete = {
                viewModel.completeTask(task)
                editTask = null
            },
            onDelete = {
                viewModel.deleteTask(task)
                editTask = null
            },
            onScheduleToday = null,
        )
    }
}
