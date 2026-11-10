package com.taskflow.android.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Today
import androidx.compose.material.icons.filled.ViewWeek
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.ViewModelProvider
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.taskflow.android.AppContainer
import com.taskflow.android.ui.auth.AuthViewModel
import com.taskflow.android.ui.auth.LoginScreen
import com.taskflow.android.ui.auth.RegisterScreen
import com.taskflow.android.ui.settings.SettingsScreen
import com.taskflow.android.ui.settings.SettingsViewModel
import com.taskflow.android.ui.tasks.InboxScreen
import com.taskflow.android.ui.tasks.TasksViewModel
import com.taskflow.android.ui.tasks.TodayScreen
import com.taskflow.android.ui.tasks.WeekScreen

private sealed class Screen(val route: String, val label: String) {
    // Auth
    object Login : Screen("login", "Login")
    object Register : Screen("register", "Register")

    // Main tabs
    object Inbox : Screen("inbox", "Inbox")
    object Today : Screen("today", "Today")
    object Week : Screen("week", "Week")
    object Settings : Screen("settings", "Settings")
}

private val bottomNavItems = listOf(
    Triple(Screen.Inbox, Icons.Default.Inbox, "Inbox"),
    Triple(Screen.Today, Icons.Default.Today, "Today"),
    Triple(Screen.Week, Icons.Default.ViewWeek, "Week"),
    Triple(Screen.Settings, Icons.Default.Settings, "Settings"),
)

private fun containerViewModelFactory(container: AppContainer): ViewModelProvider.Factory =
    object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>): T = when {
            modelClass.isAssignableFrom(AuthViewModel::class.java) -> AuthViewModel(container) as T
            modelClass.isAssignableFrom(TasksViewModel::class.java) -> TasksViewModel(container) as T
            modelClass.isAssignableFrom(SettingsViewModel::class.java) -> SettingsViewModel(container) as T
            else -> throw IllegalArgumentException("Unknown ViewModel: ${modelClass.name}")
        }
    }

@Composable
fun AppNavigation(container: AppContainer) {
    val navController = rememberNavController()
    val factory = remember(container) { containerViewModelFactory(container) }

    val authViewModel: AuthViewModel = viewModel(factory = factory)
    val tasksViewModel: TasksViewModel = viewModel(factory = factory)
    val settingsViewModel: SettingsViewModel = viewModel(factory = factory)

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val mainRoutes = setOf(Screen.Inbox.route, Screen.Today.route, Screen.Week.route, Screen.Settings.route)
    val showBottomBar = currentRoute in mainRoutes

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    bottomNavItems.forEach { (screen, icon, label) ->
                        NavigationBarItem(
                            icon = { Icon(icon, contentDescription = label) },
                            label = { Text(label) },
                            selected = currentRoute == screen.route,
                            onClick = {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                        )
                    }
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Login.route,
            modifier = Modifier.padding(padding),
        ) {
            composable(Screen.Login.route) {
                LoginScreen(
                    viewModel = authViewModel,
                    onLoginSuccess = {
                        navController.navigate(Screen.Today.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    },
                    onNavigateToRegister = { navController.navigate(Screen.Register.route) },
                )
            }

            composable(Screen.Register.route) {
                RegisterScreen(
                    viewModel = authViewModel,
                    onRegisterSuccess = {
                        navController.navigate(Screen.Today.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    },
                    onNavigateBack = { navController.popBackStack() },
                )
            }

            composable(Screen.Inbox.route) { InboxScreen(tasksViewModel) }
            composable(Screen.Today.route) { TodayScreen(tasksViewModel) }
            composable(Screen.Week.route) { WeekScreen(tasksViewModel) }
            composable(Screen.Settings.route) {
                SettingsScreen(
                    viewModel = settingsViewModel,
                    onLogout = {
                        tasksViewModel.inbox.value.let { }
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                )
            }
        }
    }
}
