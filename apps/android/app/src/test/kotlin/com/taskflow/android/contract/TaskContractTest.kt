package com.taskflow.android.contract

import com.squareup.moshi.JsonDataException
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import com.taskflow.android.data.model.Task
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Verifies that the Android [Task] data class can correctly parse every
 * JSON shape that the backend's Tasks API produces.
 *
 * The JSON fixtures here are derived from the web-side android-contract tests
 * (apps/web/__tests__/integration/android-contract/tasks.contract.test.ts).
 * Keep them in sync: if the web tests change the expected shape, update the
 * fixtures here too.
 *
 * What these tests catch:
 *  - Field renamed or removed in the API → parsing fails or wrong value
 *  - Field type changed in the API → parsing throws
 *  - Field added to the Kotlin model that doesn't exist in the API → no crash
 *    (Moshi ignores unknown JSON fields gracefully)
 */
class TaskContractTest {

    private lateinit var moshi: Moshi

    @Before
    fun setUp() {
        moshi = Moshi.Builder()
            .addLast(KotlinJsonAdapterFactory())
            .build()
    }

    // --- canonical fixtures ---------------------------------------------------

    private val MINIMAL_TASK_JSON = """
        {
          "id": "clu_task_contract_001",
          "title": "Contract test task",
          "description": null,
          "notes": null,
          "status": "INBOX",
          "priority": "MEDIUM",
          "source": "MANUAL",
          "scheduledDate": null,
          "startTime": null,
          "duration": null,
          "recurringRule": null,
          "externalId": null,
          "labels": null,
          "userId": "clu_user_contract_001",
          "completedAt": null,
          "daysOverdue": 0,
          "agentQueued": false,
          "createdAt": "2024-01-01T00:00:00.000Z",
          "updatedAt": "2024-01-01T00:00:00.000Z"
        }
    """.trimIndent()

    private val FULL_TASK_JSON = """
        {
          "id": "clu_task_contract_002",
          "title": "Scheduled task",
          "description": "A detailed description",
          "notes": "Some notes",
          "status": "SCHEDULED",
          "priority": "HIGH",
          "source": "MANUAL",
          "scheduledDate": "2024-06-01T09:00:00.000Z",
          "startTime": "09:00",
          "duration": 30,
          "recurringRule": "0 9 * * 1",
          "externalId": "notion-abc123",
          "labels": "[\"work\",\"urgent\"]",
          "userId": "clu_user_contract_001",
          "completedAt": null,
          "daysOverdue": 0,
          "agentQueued": false,
          "createdAt": "2024-01-01T00:00:00.000Z",
          "updatedAt": "2024-05-15T12:00:00.000Z"
        }
    """.trimIndent()

    private val COMPLETED_TASK_JSON = """
        {
          "id": "clu_task_contract_003",
          "title": "Completed task",
          "description": null,
          "notes": null,
          "status": "COMPLETED",
          "priority": "LOW",
          "source": "RECURRING",
          "scheduledDate": "2024-01-15T00:00:00.000Z",
          "startTime": "14:00",
          "duration": 60,
          "recurringRule": null,
          "externalId": null,
          "labels": "[\"personal\"]",
          "userId": "clu_user_contract_001",
          "completedAt": "2024-01-15T15:00:00.000Z",
          "daysOverdue": 0,
          "agentQueued": false,
          "createdAt": "2024-01-01T00:00:00.000Z",
          "updatedAt": "2024-01-15T15:00:00.000Z"
        }
    """.trimIndent()

    // --- tests ----------------------------------------------------------------

    @Test
    fun `minimal task (all nullable fields null) parses correctly`() {
        val adapter = moshi.adapter(Task::class.java)
        val task = adapter.fromJson(MINIMAL_TASK_JSON)

        assertNotNull(task)
        assertEquals("clu_task_contract_001", task!!.id)
        assertEquals("Contract test task", task.title)
        assertNull(task.description)
        assertNull(task.notes)
        assertEquals("INBOX", task.status)
        assertEquals("MEDIUM", task.priority)
        assertEquals("MANUAL", task.source)
        assertNull(task.scheduledDate)
        assertNull(task.startTime)
        assertNull(task.duration)
        assertNull(task.recurringRule)
        assertNull(task.externalId)
        assertNull(task.labels)
        assertEquals("clu_user_contract_001", task.userId)
        assertNull(task.completedAt)
        assertEquals(0, task.daysOverdue)
        assertFalse(task.agentQueued)
        assertEquals("2024-01-01T00:00:00.000Z", task.createdAt)
        assertEquals("2024-01-01T00:00:00.000Z", task.updatedAt)
    }

    @Test
    fun `fully populated task parses correctly`() {
        val adapter = moshi.adapter(Task::class.java)
        val task = adapter.fromJson(FULL_TASK_JSON)

        assertNotNull(task)
        assertEquals("clu_task_contract_002", task!!.id)
        assertEquals("Scheduled task", task.title)
        assertEquals("A detailed description", task.description)
        assertEquals("Some notes", task.notes)
        assertEquals("SCHEDULED", task.status)
        assertEquals("HIGH", task.priority)
        assertEquals("2024-06-01T09:00:00.000Z", task.scheduledDate)
        assertEquals("09:00", task.startTime)
        assertEquals(30, task.duration)
        assertEquals("0 9 * * 1", task.recurringRule)
        assertEquals("notion-abc123", task.externalId)
        // labels is a raw JSON string, not a parsed list
        assertEquals("[\"work\",\"urgent\"]", task.labels)
        assertEquals("clu_user_contract_001", task.userId)
    }

    @Test
    fun `completed task with completedAt timestamp parses correctly`() {
        val adapter = moshi.adapter(Task::class.java)
        val task = adapter.fromJson(COMPLETED_TASK_JSON)

        assertNotNull(task)
        assertEquals("COMPLETED", task!!.status)
        assertEquals("2024-01-15T15:00:00.000Z", task.completedAt)
        assertEquals("[\"personal\"]", task.labels)
    }

    @Test
    fun `labels field is a raw JSON string not a parsed array`() {
        val adapter = moshi.adapter(Task::class.java)
        val task = adapter.fromJson(FULL_TASK_JSON)!!
        // The app must parse this string with Moshi when it needs individual labels
        assertTrue(task.labels!!.startsWith("["))
        assertTrue(task.labels!!.contains("work"))
    }

    @Test
    fun `task list response (GET api-tasks) parses correctly`() {
        val json = "[$MINIMAL_TASK_JSON, $FULL_TASK_JSON]"
        val listType = Types.newParameterizedType(List::class.java, Task::class.java)
        val adapter = moshi.adapter<List<Task>>(listType)
        val tasks = adapter.fromJson(json)

        assertNotNull(tasks)
        assertEquals(2, tasks!!.size)
        assertEquals("clu_task_contract_001", tasks[0].id)
        assertEquals("clu_task_contract_002", tasks[1].id)
    }

    @Test
    fun `extra fields from API are silently ignored`() {
        // If the backend adds new fields the Android model doesn't know about,
        // Moshi must NOT crash — backward compatibility for free.
        val json = """
            {
              "id": "clu_task_contract_001",
              "title": "Test",
              "status": "INBOX",
              "priority": "MEDIUM",
              "source": "MANUAL",
              "userId": "user-1",
              "daysOverdue": 0,
              "agentQueued": false,
              "createdAt": "2024-01-01T00:00:00.000Z",
              "updatedAt": "2024-01-01T00:00:00.000Z",
              "newFieldAddedInFutureVersion": "some_value"
            }
        """.trimIndent()
        val adapter = moshi.adapter(Task::class.java)
        val task = adapter.fromJson(json)
        assertNotNull(task)
    }

    @Test(expected = JsonDataException::class)
    fun `missing required id field throws JsonDataException`() {
        // Simulates backend removing the id field — Android must not silently fail
        val json = """
            {
              "title": "No id task",
              "status": "INBOX",
              "priority": "MEDIUM",
              "source": "MANUAL",
              "userId": "user-1",
              "daysOverdue": 0,
              "agentQueued": false,
              "createdAt": "2024-01-01T00:00:00.000Z",
              "updatedAt": "2024-01-01T00:00:00.000Z"
            }
        """.trimIndent()
        moshi.adapter(Task::class.java).fromJson(json)
    }

    @Test(expected = JsonDataException::class)
    fun `missing required title field throws JsonDataException`() {
        val json = """
            {
              "id": "clu_task_contract_001",
              "status": "INBOX",
              "priority": "MEDIUM",
              "source": "MANUAL",
              "userId": "user-1",
              "daysOverdue": 0,
              "agentQueued": false,
              "createdAt": "2024-01-01T00:00:00.000Z",
              "updatedAt": "2024-01-01T00:00:00.000Z"
            }
        """.trimIndent()
        moshi.adapter(Task::class.java).fromJson(json)
    }

    @Test(expected = JsonDataException::class)
    fun `labels field as JSON array instead of string throws - API must return string`() {
        // If someone "fixes" the backend to return labels as a real JSON array,
        // this test will catch that it breaks Android (which expects a string or null).
        val json = """
            {
              "id": "clu_task_contract_001",
              "title": "Test",
              "status": "INBOX",
              "priority": "MEDIUM",
              "source": "MANUAL",
              "userId": "user-1",
              "labels": ["work", "urgent"],
              "daysOverdue": 0,
              "agentQueued": false,
              "createdAt": "2024-01-01T00:00:00.000Z",
              "updatedAt": "2024-01-01T00:00:00.000Z"
            }
        """.trimIndent()
        moshi.adapter(Task::class.java).fromJson(json)
    }
}
