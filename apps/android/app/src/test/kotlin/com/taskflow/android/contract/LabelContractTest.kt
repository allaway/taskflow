package com.taskflow.android.contract

import com.squareup.moshi.JsonDataException
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import com.taskflow.android.data.model.Label
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Verifies that the Android [Label] data class correctly parses every JSON
 * shape that GET /api/labels produces.
 *
 * Key invariants:
 *  - The API returns { name, color } — no id field.
 *  - color is always a 7-character hex string "#RRGGBB".
 *  - The response is a flat JSON array, never wrapped in an object.
 */
class LabelContractTest {

    private lateinit var moshi: Moshi

    @Before
    fun setUp() {
        moshi = Moshi.Builder()
            .addLast(KotlinJsonAdapterFactory())
            .build()
    }

    @Test
    fun `single label parses correctly`() {
        val json = """{"name": "work", "color": "#6366f1"}"""
        val label = moshi.adapter(Label::class.java).fromJson(json)

        assertNotNull(label)
        assertEquals("work", label!!.name)
        assertEquals("#6366f1", label.color)
    }

    @Test
    fun `label list response (GET api-labels) parses correctly`() {
        val json = """
            [
              {"name": "work",     "color": "#6366f1"},
              {"name": "personal", "color": "#f59e0b"},
              {"name": "urgent",   "color": "#ef4444"}
            ]
        """.trimIndent()
        val listType = Types.newParameterizedType(List::class.java, Label::class.java)
        val labels = moshi.adapter<List<Label>>(listType).fromJson(json)

        assertNotNull(labels)
        assertEquals(3, labels!!.size)
        assertEquals("work", labels[0].name)
        assertEquals("#6366f1", labels[0].color)
        assertEquals("personal", labels[1].name)
        assertEquals("urgent", labels[2].name)
    }

    @Test
    fun `empty label array parses correctly`() {
        val listType = Types.newParameterizedType(List::class.java, Label::class.java)
        val labels = moshi.adapter<List<Label>>(listType).fromJson("[]")
        assertNotNull(labels)
        assertTrue(labels!!.isEmpty())
    }

    @Test
    fun `extra fields in label response are silently ignored`() {
        val json = """{"name": "work", "color": "#6366f1", "futureField": 42}"""
        val label = moshi.adapter(Label::class.java).fromJson(json)
        assertNotNull(label)
        assertEquals("work", label!!.name)
    }

    @Test(expected = JsonDataException::class)
    fun `label with missing name throws - name is required`() {
        val json = """{"color": "#6366f1"}"""
        moshi.adapter(Label::class.java).fromJson(json)
    }

    @Test(expected = JsonDataException::class)
    fun `label with missing color throws - color is required`() {
        val json = """{"name": "work"}"""
        moshi.adapter(Label::class.java).fromJson(json)
    }

    @Test
    fun `label model must not require id field - API only returns name and color`() {
        // Regression guard: Label previously had a required id field but the API
        // doesn't return one. This ensures the model stays compatible.
        val json = """{"name": "work", "color": "#6366f1"}"""
        val label = moshi.adapter(Label::class.java).fromJson(json)
        assertNotNull("Label must parse from {name, color} with no id field", label)
        assertEquals("work", label!!.name)
        assertEquals("#6366f1", label.color)
    }

    @Test
    fun `label color is a 7-character hex string`() {
        val json = """{"name": "work", "color": "#6366f1"}"""
        val label = moshi.adapter(Label::class.java).fromJson(json)!!
        assertTrue(
            "Color must be #RRGGBB format",
            label.color.matches(Regex("^#[0-9a-fA-F]{6}$"))
        )
    }
}
