package com.taskflow.android.ui.tasks

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
fun WeekScreen(viewModel: TasksViewModel) {
    val state by viewModel.week.collectAsStateWithLifecycle()
    var editTask by remember { mutableStateOf<Task?>(null) }

    LaunchedEffect(Unit) { viewModel.loadWeek() }

    val today = LocalDate.now()
    val weekDates = (0..6).map { today.plusDays(it.toLong()) }
    val isoFormatter = DateTimeFormatter.ISO_LOCAL_DATE

    Scaffold(topBar = { TopAppBar(title = { Text("This Week") }) }) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.isLoading -> CircularProgressIndicator(Modifier.align(Alignment.Center))
                state.error != null -> Text(
                    state.error!!,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.align(Alignment.Center).padding(16.dp),
                )
                else -> LazyColumn(contentPadding = PaddingValues(16.dp)) {
                    weekDates.forEach { date ->
                        val dateStr = date.format(isoFormatter)
                        val dayTasks = state.tasks.filter { it.scheduledDate?.startsWith(dateStr) == true }
                        val dayLabel = if (date == today) "Today" else
                            date.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.getDefault())

                        item(key = "header-$dateStr") {
                            Text(
                                text = "$dayLabel · ${date.month.getDisplayName(TextStyle.SHORT, Locale.getDefault())} ${date.dayOfMonth}",
                                style = MaterialTheme.typography.labelLarge,
                                color = if (date == today) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(vertical = 8.dp),
                            )
                        }

                        if (dayTasks.isEmpty()) {
                            item(key = "empty-$dateStr") {
                                Text(
                                    "—",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.outlineVariant,
                                    modifier = Modifier.padding(bottom = 8.dp),
                                )
                            }
                        } else {
                            items(dayTasks, key = { it.id }) { task ->
                                TaskCard(
                                    task = task,
                                    onComplete = { viewModel.completeTask(task) },
                                    onClick = { editTask = task },
                                    modifier = Modifier.padding(bottom = 8.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
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
