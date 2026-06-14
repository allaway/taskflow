package com.taskflow.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.taskflow.android.ui.navigation.AppNavigation
import com.taskflow.android.ui.theme.TaskFlowTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as TaskFlowApp
        setContent {
            TaskFlowTheme {
                AppNavigation(container = app.container)
            }
        }
    }
}
