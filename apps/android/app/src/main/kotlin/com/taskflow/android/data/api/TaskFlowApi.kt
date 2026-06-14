package com.taskflow.android.data.api

import com.taskflow.android.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface TaskFlowApi {

    // Auth
    @GET("api/auth/csrf")
    suspend fun getCsrfToken(): Response<CsrfResponse>

    @FormUrlEncoded
    @POST("api/auth/callback/credentials")
    suspend fun signIn(
        @Field("csrfToken") csrfToken: String,
        @Field("email") email: String,
        @Field("password") password: String,
        @Field("json") json: String = "true",
        @Field("redirect") redirect: String = "false",
    ): Response<Unit>

    @POST("api/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<RegisterResponse>

    @GET("api/auth/session")
    suspend fun getSession(): Response<SessionResponse>

    @POST("api/auth/signout")
    @FormUrlEncoded
    suspend fun signOut(@Field("csrfToken") csrfToken: String): Response<Unit>

    // Tasks
    @GET("api/tasks")
    suspend fun getTasks(
        @Query("status") status: String? = null,
        @Query("date") date: String? = null,
    ): Response<List<Task>>

    @POST("api/tasks")
    suspend fun createTask(@Body request: CreateTaskRequest): Response<Task>

    @PATCH("api/tasks/{id}")
    suspend fun updateTask(
        @Path("id") id: String,
        @Body request: UpdateTaskRequest,
    ): Response<Task>

    @DELETE("api/tasks/{id}")
    suspend fun deleteTask(@Path("id") id: String): Response<Unit>

    // Labels
    @GET("api/labels")
    suspend fun getLabels(): Response<List<Label>>
}
