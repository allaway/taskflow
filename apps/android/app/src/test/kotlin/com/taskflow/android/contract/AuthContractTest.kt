package com.taskflow.android.contract

import com.squareup.moshi.JsonDataException
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import com.taskflow.android.data.model.RegisterResponse
import com.taskflow.android.data.model.CsrfResponse
import com.taskflow.android.data.model.SessionResponse
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Verifies that the Android auth model classes can correctly parse every JSON
 * shape that the backend's Auth API produces.
 *
 * Covered endpoints:
 *  - GET  /api/auth/csrf            → CsrfResponse
 *  - POST /api/auth/register        → RegisterResponse (HTTP 201)
 *  - GET  /api/auth/session         → SessionResponse
 */
class AuthContractTest {

    private lateinit var moshi: Moshi

    @Before
    fun setUp() {
        moshi = Moshi.Builder()
            .addLast(KotlinJsonAdapterFactory())
            .build()
    }

    // --- RegisterResponse (POST /api/auth/register 201) ----------------------

    @Test
    fun `register success response parses correctly`() {
        val json = """
            {
              "id": "clu_user_new_001",
              "email": "newuser@example.com",
              "name": "New User"
            }
        """.trimIndent()
        val response = moshi.adapter(RegisterResponse::class.java).fromJson(json)

        assertNotNull(response)
        assertEquals("clu_user_new_001", response!!.id)
        assertEquals("newuser@example.com", response.email)
        assertEquals("New User", response.name)
    }

    @Test
    fun `register response with null name parses correctly`() {
        val json = """
            {
              "id": "clu_user_new_002",
              "email": "noname@example.com",
              "name": null
            }
        """.trimIndent()
        val response = moshi.adapter(RegisterResponse::class.java).fromJson(json)

        assertNotNull(response)
        assertNull(response!!.name)
    }

    @Test
    fun `register response does not include passwordHash`() {
        // Safety check: the server must never expose the password hash.
        // If it ever does, this JSON would fail to parse the model (extra field is
        // ignored by Moshi) but we document the expectation explicitly.
        val safeJson = """
            {
              "id": "clu_user_new_001",
              "email": "user@example.com",
              "name": "User"
            }
        """.trimIndent()
        val response = moshi.adapter(RegisterResponse::class.java).fromJson(safeJson)!!
        // Kotlin reflection would expose a passwordHash property if it existed on the model
        val properties = response.javaClass.declaredFields.map { it.name }
        assertFalse("passwordHash must never be in RegisterResponse", properties.contains("passwordHash"))
    }

    @Test(expected = JsonDataException::class)
    fun `register response without id throws - id is required`() {
        val json = """{"email": "user@example.com", "name": "User"}"""
        moshi.adapter(RegisterResponse::class.java).fromJson(json)
    }

    @Test(expected = JsonDataException::class)
    fun `register response without email throws - email is required`() {
        val json = """{"id": "clu_001", "name": "User"}"""
        moshi.adapter(RegisterResponse::class.java).fromJson(json)
    }

    // --- CsrfResponse (GET /api/auth/csrf) -----------------------------------

    @Test
    fun `CSRF token response parses correctly`() {
        val json = """{"csrfToken": "abc123def456"}"""
        val response = moshi.adapter(CsrfResponse::class.java).fromJson(json)

        assertNotNull(response)
        assertEquals("abc123def456", response!!.csrfToken)
    }

    @Test(expected = JsonDataException::class)
    fun `CSRF response without csrfToken throws`() {
        moshi.adapter(CsrfResponse::class.java).fromJson("{}")
    }

    // --- SessionResponse (GET /api/auth/session) -----------------------------

    @Test
    fun `authenticated session response parses correctly`() {
        val json = """
            {
              "user": {
                "id": "clu_user_001",
                "email": "user@example.com",
                "name": "User Name"
              }
            }
        """.trimIndent()
        val response = moshi.adapter(SessionResponse::class.java).fromJson(json)

        assertNotNull(response)
        assertNotNull(response!!.user)
        assertEquals("clu_user_001", response.user!!.id)
        assertEquals("user@example.com", response.user!!.email)
    }

    @Test
    fun `unauthenticated session response (null user) parses correctly`() {
        val json = """{}"""
        val response = moshi.adapter(SessionResponse::class.java).fromJson(json)
        assertNotNull(response)
        assertNull(response!!.user)
    }
}
