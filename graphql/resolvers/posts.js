const {AuthenticationError, UserInputError} = require('apollo-server')

const Post = require('../../models/Post')
const checkAuth = require('../../util/checkAuth')

module.exports = {
    Query: {
        async getPosts() {
            try {
                return await Post.find().sort({createdAt: -1})
            } catch (e) {
                throw new Error(e)
            }
        },
        async getPost(_, {postId}) {
            try {
                const post = await Post.findById(postId)
                if (post) {
                    return post
                }
            } catch (e) {
                throw new Error('Post not found')
            }
        },
    },
    Mutation: {
        async createPost(_, {body}, context) {
            const user = checkAuth(context)
            if (body.trim() === ""){
                throw new Error('Post body must not be empty')
            }
            const newPost = new Post({
                body,
                user: user.id,
                username: user.username,
                createdAt: new Date().toISOString()
            })
            const post = await newPost.save()
            await context.pubSub.publish('NEW_POST', {
                newPost: post
            })
            return post
        },
        async deletePost(_, {postId}, context) {
            const user = checkAuth(context)
            try {
                const post = await Post.findById(postId)
                if (user.username === post.username) {
                    await post.delete()
                    return 'Post deleted successfully'
                } else {
                    return new AuthenticationError('Action not allowed')
                }
            } catch (e) {
                return  new Error('Post not found')
            }
        },
        async likePost(_, {postId}, context){
            const {username} = checkAuth(context)
            const post = await Post.findById(postId)
            if (post){
                if (post.likes.find(like => like.username === username)){
                    //Post already liked, unlike it
                    post.likes = post.likes.filter(like => like.username !== username)
                } else {
                    //Not liked, like post
                    post.likes.push({
                        username,
                        createdAt: new Date().toISOString()
                    })
                }
                await post.save()
                return post
            } else throw new UserInputError('Post not found')
        }
    },
    Subscription: {
        newPost: {
            subscribe: (_, __, {pubSub}) => pubSub.asyncIterator('NEW_POST')
        }
    }
}
